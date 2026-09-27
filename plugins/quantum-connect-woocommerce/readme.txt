=== Quantum Connect for WooCommerce ===
Contributors: quantumtax
Tags: woocommerce, pact act, tax, vape, excise
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Sends WooCommerce orders to Quantum for PACT Act and state vapor/tobacco tax reporting.

== Description ==

Quantum prepares PACT Act reports and state vapor/tobacco excise and sales tax returns. PACT reports need who each order shipped to, where, when and what — data that lives in your store, not in your sales-tax software.

This plugin sends each order to your Quantum the moment it is placed or changes status. Cancelled and refunded orders are sent too, so Quantum removes them from the report.

* One-button connect: press "Connect to Quantum", approve, done. No API keys to copy.
* Real-time: orders are sent in the background, never slowing checkout.
* Backfill: send past orders from any date, in batches.
* Safe: Quantum only receives. The plugin never modifies products, orders or settings.
* Retries: if Quantum is unreachable, failed orders are retried every hour.
* HPOS (custom order tables) compatible.

= What is sent =

For each order: order id and number, date, status, billing email, shipping name, company and address, and each shipped line's name, SKU, brand and quantity. Virtual products are not sent. No payment details are ever sent.

== Installation ==

1. Upload the zip under Plugins → Add New → Upload Plugin, and activate.
2. Go to WooCommerce → Quantum Connect.
3. Press "Connect to Quantum", sign in to Quantum and approve the store.
4. Optionally, send past orders from the date you choose.

== Frequently Asked Questions ==

= Does this change anything in my store? =

No. It reads orders and sends them to Quantum. It adds one hidden meta field per order to remember what was last sent.

= What happens if I disconnect? =

Orders stop being sent. Orders already in Quantum stay there, because PACT records must be kept.

== Changelog ==

= 1.0.0 =
* First release: one-button pairing, real-time push, backfill, hourly retry.
