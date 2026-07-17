"use server";

import { sbWrite } from "../../lib/supabase";
import { revalidatePath } from "next/cache";

/**
 * Server Action to update or clear the supply mode of a material.
 * @param {string} component - Material name
 * @param {string} mode - 'Normal' (deletes row) | 'Consignment' | 'Daily'
 */
export async function updateSupplyMode(component, mode) {
  const compKey = String(component || "").trim();
  if (!compKey) return { success: false, error: "Empty component name" };

  try {
    if (mode === "Normal") {
      // Delete the component override from material_supply
      await sbWrite(`material_supply?component=eq.${encodeURIComponent(compKey)}`, null, {
        method: "DELETE",
      });
    } else {
      // Upsert the component override
      await sbWrite("material_supply", [
        { component: compKey, supply_mode: mode, note: "Updated from Dashboard" }
      ], {
        prefer: "resolution=merge-duplicates",
      });
    }
    revalidatePath("/mrp");
    return { success: true };
  } catch (e) {
    console.error("Failed to update supply mode:", e);
    return { success: false, error: e.message };
  }
}
