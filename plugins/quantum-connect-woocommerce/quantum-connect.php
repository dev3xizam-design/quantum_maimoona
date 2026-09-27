<?php
/**
 * Plugin Name:       Quantum Connect for WooCommerce
 * Plugin URI:        https://quantumtax.app/marketplace/woocommerce
 * Description:       Sends WooCommerce orders to Quantum the moment they change, for PACT Act and state tobacco/vapor tax reporting. Read-only toward your store: nothing in WooCommerce is modified.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * WC requires at least: 7.0
 * WC tested up to:   9.9
 * Author:            Quantum
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       quantum-connect
 */

defined( 'ABSPATH' ) || exit;

define( 'QUANTUM_CONNECT_VERSION', '1.0.0' );
// Replaced with the Quantum address when the plugin is downloaded from a Quantum; blank in the public build.
define( 'QUANTUM_CONNECT_DEFAULT_URL', '{{QUANTUM_URL}}' );

final class Quantum_Connect {

	const OPT_URL     = 'quantum_connect_url';
	const OPT_KEY     = 'quantum_connect_key';
	const OPT_STORE   = 'quantum_connect_store';
	const OPT_LAST    = 'quantum_connect_last_push';
	const OPT_ERROR   = 'quantum_connect_last_error';
	const META_SENT   = '_quantum_sent_hash';
	const META_RETRY  = '_quantum_retry';
	const HOOK_PUSH   = 'quantum_connect_push_order';
	const HOOK_RETRY  = 'quantum_connect_retry';
	const PAGE        = 'quantum-connect';
	const BATCH       = 50;

	public static function init() {
		add_action( 'before_woocommerce_init', array( __CLASS__, 'declare_hpos' ) );
		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 60 );
		add_action( 'admin_init', array( __CLASS__, 'handle_return' ) );
		add_action( 'admin_post_quantum_connect_start', array( __CLASS__, 'start_pairing' ) );
		add_action( 'admin_post_quantum_connect_disconnect', array( __CLASS__, 'disconnect' ) );
		add_action( 'wp_ajax_quantum_connect_backfill', array( __CLASS__, 'ajax_backfill' ) );

		// Every status change re-sends the order; Quantum upserts, so repeats are harmless.
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'queue_order' ), 20, 1 );
		add_action( 'woocommerce_checkout_order_processed', array( __CLASS__, 'queue_order' ), 20, 1 );
		add_action( self::HOOK_PUSH, array( __CLASS__, 'push_one' ), 10, 1 );
		add_action( self::HOOK_RETRY, array( __CLASS__, 'retry_failed' ) );

		add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), array( __CLASS__, 'action_links' ) );
		register_activation_hook( __FILE__, array( __CLASS__, 'activate' ) );
		register_deactivation_hook( __FILE__, array( __CLASS__, 'deactivate' ) );
	}

	public static function declare_hpos() {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		}
	}

	public static function activate() {
		if ( ! wp_next_scheduled( self::HOOK_RETRY ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', self::HOOK_RETRY );
		}
		if ( ! get_option( self::OPT_URL ) && self::default_url() ) {
			update_option( self::OPT_URL, self::default_url(), false );
		}
	}

	public static function deactivate() {
		wp_clear_scheduled_hook( self::HOOK_RETRY );
	}

	private static function default_url() {
		$url = QUANTUM_CONNECT_DEFAULT_URL;
		return ( 0 === strpos( $url, 'http' ) ) ? untrailingslashit( $url ) : '';
	}

	private static function quantum_url() {
		$url = get_option( self::OPT_URL );
		return $url ? untrailingslashit( $url ) : self::default_url();
	}

	private static function key() {
		return (string) get_option( self::OPT_KEY, '' );
	}

	private static function site_origin() {
		$parts = wp_parse_url( home_url() );
		$port  = isset( $parts['port'] ) ? ':' . $parts['port'] : '';
		return $parts['scheme'] . '://' . $parts['host'] . $port;
	}

	private static function settings_url( $args = array() ) {
		return add_query_arg( $args, admin_url( 'admin.php?page=' . self::PAGE ) );
	}

	public static function action_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( self::settings_url() ) . '">' . esc_html__( 'Settings', 'quantum-connect' ) . '</a>' );
		return $links;
	}

	public static function menu() {
		add_submenu_page(
			'woocommerce',
			__( 'Quantum Connect', 'quantum-connect' ),
			__( 'Quantum Connect', 'quantum-connect' ),
			'manage_woocommerce',
			self::PAGE,
			array( __CLASS__, 'render' )
		);
	}

	/* ------------------------------------------------------------------ */
	/* Pairing: button -> Quantum approve screen -> back here with a code  */
	/* ------------------------------------------------------------------ */

	public static function start_pairing() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'Not allowed.', 'quantum-connect' ) );
		}
		check_admin_referer( 'quantum_connect_start' );

		$url = isset( $_POST['quantum_url'] ) ? esc_url_raw( wp_unslash( $_POST['quantum_url'] ) ) : '';
		$url = untrailingslashit( $url );
		if ( ! $url || 0 !== strpos( $url, 'https://' ) && false === strpos( $url, '://localhost' ) ) {
			wp_safe_redirect( self::settings_url( array( 'quantum_error' => rawurlencode( __( 'Enter your Quantum address, starting with https://', 'quantum-connect' ) ) ) ) );
			exit;
		}
		update_option( self::OPT_URL, $url, false );

		$state = wp_generate_password( 32, false );
		set_transient( 'quantum_connect_state_' . get_current_user_id(), $state, 15 * MINUTE_IN_SECONDS );

		$target = add_query_arg(
			array(
				'site'     => rawurlencode( self::site_origin() ),
				'return'   => rawurlencode( self::settings_url( array( 'quantum_return' => 1 ) ) ),
				'state'    => rawurlencode( $state ),
				'platform' => 'woocommerce',
				'name'     => rawurlencode( get_bloginfo( 'name' ) ),
			),
			$url . '/connect/pair'
		);
		// Leaving the site on purpose, to the address the admin just typed.
		wp_redirect( $target ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
		exit;
	}

	public static function handle_return() {
		if ( empty( $_GET['page'] ) || self::PAGE !== $_GET['page'] || empty( $_GET['quantum_return'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			return;
		}
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$code     = isset( $_GET['quantum_code'] ) ? sanitize_text_field( wp_unslash( $_GET['quantum_code'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$state    = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$expected = get_transient( 'quantum_connect_state_' . get_current_user_id() );
		delete_transient( 'quantum_connect_state_' . get_current_user_id() );

		if ( ! $code || ! $expected || ! hash_equals( (string) $expected, $state ) ) {
			wp_safe_redirect( self::settings_url( array( 'quantum_error' => rawurlencode( __( 'That approval expired or did not match. Press Connect again.', 'quantum-connect' ) ) ) ) );
			exit;
		}

		$res = wp_remote_post(
			self::quantum_url() . '/api/plugin/v1/pair',
			array(
				'timeout' => 20,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( array( 'code' => $code, 'site' => self::site_origin() ) ),
			)
		);
		$body = is_wp_error( $res ) ? null : json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $body['key'] ) ) {
			$msg = is_wp_error( $res ) ? $res->get_error_message() : ( isset( $body['error'] ) ? $body['error'] : __( 'Quantum did not issue a key.', 'quantum-connect' ) );
			wp_safe_redirect( self::settings_url( array( 'quantum_error' => rawurlencode( $msg ) ) ) );
			exit;
		}

		update_option( self::OPT_KEY, sanitize_text_field( $body['key'] ), false );
		update_option( self::OPT_STORE, sanitize_text_field( isset( $body['store'] ) ? $body['store'] : '' ), false );
		delete_option( self::OPT_ERROR );
		wp_safe_redirect( self::settings_url( array( 'quantum_connected' => 1 ) ) );
		exit;
	}

	public static function disconnect() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'Not allowed.', 'quantum-connect' ) );
		}
		check_admin_referer( 'quantum_connect_disconnect' );
		delete_option( self::OPT_KEY );
		delete_option( self::OPT_STORE );
		delete_option( self::OPT_ERROR );
		wp_safe_redirect( self::settings_url() );
		exit;
	}

	/* ------------------------------------------------------------------ */
	/* Order -> Connect API payload                                        */
	/* ------------------------------------------------------------------ */

	public static function payload( $order ) {
		$lines = array();
		foreach ( $order->get_items( 'line_item' ) as $item_id => $item ) {
			$product = $item->get_product();
			if ( $product && $product->is_virtual() ) {
				continue;
			}
			$qty = (float) $item->get_quantity() + (float) $order->get_qty_refunded_for_item( $item_id );
			$lines[] = array(
				'id'       => (string) $item_id,
				'name'     => $item->get_name(),
				'sku'      => $product ? $product->get_sku() : null,
				'brand'    => self::brand( $product ),
				'quantity' => $qty,
			);
		}

		$created = $order->get_date_created();
		$has_ship = $order->get_shipping_address_1() || $order->get_shipping_state();

		return array(
			'id'         => (string) $order->get_id(),
			'number'     => '#' . $order->get_order_number(),
			// Store-local date: the month the merchant sees the order in.
			'created_at' => $created ? $created->date( 'Y-m-d\TH:i:s' ) : gmdate( 'Y-m-d\TH:i:s' ),
			'status'     => $order->get_status(),
			'email'      => $order->get_billing_email(),
			'ship_to'    => $has_ship ? array(
				'first_name' => $order->get_shipping_first_name(),
				'last_name'  => $order->get_shipping_last_name(),
				'company'    => $order->get_shipping_company(),
				'address1'   => $order->get_shipping_address_1(),
				'address2'   => $order->get_shipping_address_2(),
				'city'       => $order->get_shipping_city(),
				'state'      => $order->get_shipping_state(),
				'zip'        => $order->get_shipping_postcode(),
				'country'    => $order->get_shipping_country(),
			) : null,
			'lines'      => $lines,
		);
	}

	private static function brand( $product ) {
		if ( ! $product ) {
			return null;
		}
		$id = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();
		foreach ( array( 'product_brand', 'pwb-brand', 'yith_product_brand' ) as $tax ) {
			if ( taxonomy_exists( $tax ) ) {
				$terms = wp_get_post_terms( $id, $tax, array( 'fields' => 'names' ) );
				if ( ! is_wp_error( $terms ) && $terms ) {
					return $terms[0];
				}
			}
		}
		return null;
	}

	/** POST up to 250 orders. Returns the decoded response or a WP_Error. */
	private static function send( array $orders ) {
		if ( ! self::key() ) {
			return new WP_Error( 'quantum_not_connected', __( 'Not connected to Quantum.', 'quantum-connect' ) );
		}
		$res = wp_remote_post(
			self::quantum_url() . '/api/plugin/v1/orders',
			array(
				'timeout' => 30,
				'headers' => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . self::key(),
					'User-Agent'    => 'QuantumConnect-WooCommerce/' . QUANTUM_CONNECT_VERSION,
				),
				'body'    => wp_json_encode( array( 'platform' => 'woocommerce', 'orders' => $orders ) ),
			)
		);
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$code = wp_remote_retrieve_response_code( $res );
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = isset( $body['error'] ) ? $body['error'] : 'HTTP ' . $code;
			if ( ! empty( $body['issues'] ) ) {
				$msg .= ' ' . implode( '; ', (array) $body['issues'] );
			}
			return new WP_Error( 'quantum_http_' . $code, $msg );
		}
		update_option( self::OPT_LAST, time(), false );
		delete_option( self::OPT_ERROR );
		return $body;
	}

	/* ------------------------------------------------------------------ */
	/* Real-time push, off the checkout request                            */
	/* ------------------------------------------------------------------ */

	public static function queue_order( $order_id ) {
		if ( ! self::key() || ! $order_id ) {
			return;
		}
		if ( function_exists( 'as_enqueue_async_action' ) ) {
			as_enqueue_async_action( self::HOOK_PUSH, array( (int) $order_id ), 'quantum-connect' );
		} else {
			wp_schedule_single_event( time() + 5, self::HOOK_PUSH, array( (int) $order_id ) );
		}
	}

	public static function push_one( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order || 'shop_order_refund' === $order->get_type() ) {
			return;
		}
		$payload = self::payload( $order );
		$hash    = md5( wp_json_encode( $payload ) );
		if ( $order->get_meta( self::META_SENT ) === $hash ) {
			return; // Nothing Quantum cares about changed.
		}
		$result = self::send( array( $payload ) );
		if ( is_wp_error( $result ) ) {
			update_option( self::OPT_ERROR, $result->get_error_message(), false );
			$order->update_meta_data( self::META_RETRY, 1 );
		} else {
			$order->update_meta_data( self::META_SENT, $hash );
			$order->delete_meta_data( self::META_RETRY );
		}
		$order->save_meta_data();
	}

	public static function retry_failed() {
		if ( ! self::key() ) {
			return;
		}
		$ids = wc_get_orders(
			array(
				'limit'      => 100,
				'return'     => 'ids',
				'meta_key'   => self::META_RETRY, // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value' => 1, // phpcs:ignore WordPress.DB.SlowDBQuery
			)
		);
		foreach ( $ids as $id ) {
			self::push_one( $id );
		}
	}

	/* ------------------------------------------------------------------ */
	/* Backfill: past orders, in batches, driven from the settings page    */
	/* ------------------------------------------------------------------ */

	public static function ajax_backfill() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => 'Not allowed.' ), 403 );
		}
		check_ajax_referer( 'quantum_connect_backfill' );
		$page  = isset( $_POST['page'] ) ? max( 1, absint( $_POST['page'] ) ) : 1;
		$since = isset( $_POST['since'] ) ? sanitize_text_field( wp_unslash( $_POST['since'] ) ) : '';

		$args = array(
			'limit'    => self::BATCH,
			'paged'    => $page,
			'orderby'  => 'date',
			'order'    => 'ASC',
			'type'     => 'shop_order',
			'paginate' => true,
		);
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $since ) ) {
			$args['date_created'] = '>=' . $since;
		}
		$found  = wc_get_orders( $args );
		$orders = array();
		foreach ( $found->orders as $order ) {
			$orders[] = self::payload( $order );
		}
		$result = $orders ? self::send( $orders ) : array( 'shipment_lines' => 0 );
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}
		foreach ( $found->orders as $i => $order ) {
			$order->update_meta_data( self::META_SENT, md5( wp_json_encode( $orders[ $i ] ) ) );
			$order->save_meta_data();
		}
		wp_send_json_success(
			array(
				'page'   => $page,
				'pages'  => (int) $found->max_num_pages,
				'total'  => (int) $found->total,
				'sent'   => count( $orders ),
				'lines'  => isset( $result['shipment_lines'] ) ? (int) $result['shipment_lines'] : 0,
			)
		);
	}

	/* ------------------------------------------------------------------ */
	/* Settings page                                                       */
	/* ------------------------------------------------------------------ */

	private static function ping() {
		$res = wp_remote_get(
			self::quantum_url() . '/api/plugin/v1/ping',
			array(
				'timeout' => 10,
				'headers' => array( 'Authorization' => 'Bearer ' . self::key() ),
			)
		);
		if ( is_wp_error( $res ) ) {
			return $res->get_error_message();
		}
		return 200 === wp_remote_retrieve_response_code( $res ) ? true : __( 'Quantum no longer recognises this key — connect again.', 'quantum-connect' );
	}

	public static function render() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$connected = (bool) self::key();
		$ping      = $connected ? self::ping() : null;
		$last      = (int) get_option( self::OPT_LAST, 0 );
		$error     = get_option( self::OPT_ERROR );
		$notice    = isset( $_GET['quantum_error'] ) ? sanitize_text_field( wp_unslash( $_GET['quantum_error'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		?>
		<div class="wrap" style="max-width:760px">
			<h1><?php esc_html_e( 'Quantum Connect', 'quantum-connect' ); ?></h1>
			<p><?php esc_html_e( 'Sends every WooCommerce order to Quantum for PACT Act and state vapor/tobacco tax reporting — customer, ship-to address, products and quantities. Quantum only receives; it never changes anything in this store.', 'quantum-connect' ); ?></p>

			<?php if ( $notice ) : ?>
				<div class="notice notice-error"><p><?php echo esc_html( $notice ); ?></p></div>
			<?php endif; ?>
			<?php if ( isset( $_GET['quantum_connected'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
				<div class="notice notice-success"><p><?php esc_html_e( 'Connected. New and changed orders now go to Quantum automatically. Send your past orders below.', 'quantum-connect' ); ?></p></div>
			<?php endif; ?>

			<div class="card" style="max-width:none;padding:16px 20px">
			<?php if ( $connected ) : ?>
				<h2 style="margin-top:0">
					<?php if ( true === $ping ) : ?>
						<span style="color:#008a20">●</span> <?php echo esc_html( sprintf( /* translators: %s store name */ __( 'Connected to Quantum as “%s”', 'quantum-connect' ), get_option( self::OPT_STORE ) ) ); ?>
					<?php else : ?>
						<span style="color:#d63638">●</span> <?php esc_html_e( 'Connection problem', 'quantum-connect' ); ?>
					<?php endif; ?>
				</h2>
				<?php if ( true !== $ping ) : ?>
					<p><?php echo esc_html( (string) $ping ); ?></p>
				<?php endif; ?>
				<p>
					<?php echo esc_html( self::quantum_url() ); ?> ·
					<?php echo $last ? esc_html( sprintf( /* translators: %s time ago */ __( 'last order sent %s ago', 'quantum-connect' ), human_time_diff( $last ) ) ) : esc_html__( 'no orders sent yet', 'quantum-connect' ); ?>
				</p>
				<?php if ( $error ) : ?>
					<p style="color:#d63638"><?php echo esc_html( sprintf( /* translators: %s error */ __( 'Last error: %s — failed orders are retried every hour.', 'quantum-connect' ), $error ) ); ?></p>
				<?php endif; ?>

				<h3><?php esc_html_e( 'Send past orders', 'quantum-connect' ); ?></h3>
				<p><?php esc_html_e( 'Quantum de-duplicates, so sending an order twice is safe.', 'quantum-connect' ); ?></p>
				<p>
					<label><?php esc_html_e( 'From', 'quantum-connect' ); ?>
						<input type="date" id="quantum-since" value="<?php echo esc_attr( gmdate( 'Y-01-01', strtotime( '-1 year' ) ) ); ?>">
					</label>
					<button type="button" class="button button-primary" id="quantum-backfill"><?php esc_html_e( 'Send orders', 'quantum-connect' ); ?></button>
				</p>
				<p id="quantum-progress"></p>

				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return confirm('<?php echo esc_js( __( 'Stop sending orders to Quantum?', 'quantum-connect' ) ); ?>')">
					<input type="hidden" name="action" value="quantum_connect_disconnect">
					<?php wp_nonce_field( 'quantum_connect_disconnect' ); ?>
					<button class="button-link" style="color:#d63638"><?php esc_html_e( 'Disconnect', 'quantum-connect' ); ?></button>
				</form>

				<script>
				(function () {
					var btn = document.getElementById('quantum-backfill');
					var out = document.getElementById('quantum-progress');
					var sent = 0, lines = 0;
					function run(page) {
						var body = new FormData();
						body.append('action', 'quantum_connect_backfill');
						body.append('_ajax_nonce', <?php echo wp_json_encode( wp_create_nonce( 'quantum_connect_backfill' ) ); ?>);
						body.append('page', page);
						body.append('since', document.getElementById('quantum-since').value);
						fetch(ajaxurl, { method: 'POST', body: body, credentials: 'same-origin' })
							.then(function (r) { return r.json(); })
							.then(function (r) {
								if (!r.success) { out.textContent = 'Stopped: ' + (r.data && r.data.message); btn.disabled = false; return; }
								sent += r.data.sent; lines += r.data.lines;
								out.textContent = sent + ' of ' + r.data.total + ' orders sent (' + lines + ' shipment lines)…';
								if (r.data.page < r.data.pages) { run(page + 1); } else { out.textContent = 'Done — ' + sent + ' orders, ' + lines + ' shipment lines now in Quantum.'; btn.disabled = false; }
							})
							.catch(function (e) { out.textContent = 'Stopped: ' + e; btn.disabled = false; });
					}
					btn.addEventListener('click', function () { btn.disabled = true; sent = 0; lines = 0; out.textContent = 'Starting…'; run(1); });
				})();
				</script>
			<?php else : ?>
				<h2 style="margin-top:0"><?php esc_html_e( 'Connect this store', 'quantum-connect' ); ?></h2>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="quantum_connect_start">
					<?php wp_nonce_field( 'quantum_connect_start' ); ?>
					<p>
						<label for="quantum_url"><strong><?php esc_html_e( 'Your Quantum address', 'quantum-connect' ); ?></strong></label><br>
						<input type="url" class="regular-text" id="quantum_url" name="quantum_url" required placeholder="https://your-quantum.vercel.app" value="<?php echo esc_attr( self::quantum_url() ); ?>">
					</p>
					<p><button class="button button-primary button-hero"><?php esc_html_e( 'Connect to Quantum', 'quantum-connect' ); ?></button></p>
					<p class="description"><?php esc_html_e( 'You will sign in to Quantum and approve this store, then come straight back here.', 'quantum-connect' ); ?></p>
				</form>
			<?php endif; ?>
			</div>
		</div>
		<?php
	}
}

Quantum_Connect::init();
