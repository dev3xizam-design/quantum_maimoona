import { SimpleUploader } from "../SimpleUploader";

export const dynamic = "force-dynamic";

export default function ProductMasterUploadPage() {
  return (
    <div className="space-y-4">
      <SimpleUploader
        kind="products"
        title="Product master"
        blurb="Optional — the catalog already builds itself from the Avalara export. Use this to bulk-fill the things it cannot know: wholesale cost, mL per unit, and the OPEN/CLOSED flag bifurcated states need. Every value here is locked and survives future uploads."
        columns="sku, description, wholesale_cost, retail_price, liquid_ml, cartridges_per_unit, system_type (OPEN/CLOSED), contains_nicotine"
      />
      <div className="help">
        Prefer editing on the <strong>Products</strong> page when it is a handful of SKUs — it is
        ordered by revenue, so the ones that move the tax come first. Use this file when you have
        cost data for hundreds of SKUs at once.
      </div>
    </div>
  );
}
