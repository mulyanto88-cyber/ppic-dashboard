"use server";

import { sbWrite } from "../../lib/supabase";
import { revalidatePath } from "next/cache";

/**
 * Creates or updates a SKU in the product_master table.
 * @param {string} skuName - Name of the SKU (unique)
 * @param {object} data - SKU fields
 */
export async function saveSkuMaster(skuName, data) {
  try {
    const record = {
      sku_name: String(skuName).trim(),
      type: data.type || null,
      series: data.series || null,
      brand: data.brand || null,
      status: data.status || "Continue",
      sub_category: data.sub_category || null,
      barcode: data.barcode || null,
      unique_label: data.unique_label || null,
      updated_at: new Date().toISOString()
    };

    // Upsert on sku_name (Supabase maps this automatically since it's unique)
    await sbWrite("product_master", [record], {
      prefer: "resolution=merge-duplicates",
    });

    revalidatePath("/deep-dive");
    return { success: true };
  } catch (e) {
    console.error("saveSkuMaster error:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Deletes a SKU from the product_master table.
 * @param {string} skuName - Name of the SKU to delete
 */
export async function deleteSkuMaster(skuName) {
  try {
    const compUpper = String(skuName).trim();
    await sbWrite(`product_master?sku_name=eq.${encodeURIComponent(compUpper)}`, null, {
      method: "DELETE",
    });

    revalidatePath("/deep-dive");
    return { success: true };
  } catch (e) {
    console.error("deleteSkuMaster error:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Bulk upserts an array of parsed SKU records into product_master.
 * @param {Array} rows - List of SKU records
 */
export async function bulkUploadSkuMaster(rows) {
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, error: "No records found to upload" };
    }

    const records = rows.map((r) => ({
      sku_name: String(r.sku_name || "").trim(),
      type: r.type || null,
      series: r.series || null,
      brand: r.brand || null,
      status: r.status || "Continue",
      sub_category: r.sub_category || null,
      barcode: r.barcode || null,
      unique_label: r.unique_label || null,
      updated_at: new Date().toISOString()
    })).filter(r => r.sku_name !== "");

    if (records.length === 0) {
      return { success: false, error: "No valid records with SKU Name found" };
    }

    // Batch upload to prevent payload size limits (100 rows per batch)
    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE);
      await sbWrite("product_master", chunk, {
        prefer: "resolution=merge-duplicates",
      });
    }

    revalidatePath("/deep-dive");
    return { success: true, count: records.length };
  } catch (e) {
    console.error("bulkUploadSkuMaster error:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Creates or updates a material in the material_master table.
 */
export async function saveMaterialMaster(materialName, data) {
  try {
    const record = {
      material_name: String(materialName).trim(),
      vendor_name: data.vendor_name || null,
      lead_time_days: isNaN(Number(data.lead_time_days)) ? 14 : Number(data.lead_time_days),
      moq: isNaN(Number(data.moq)) ? 0 : Number(data.moq),
      safety_stock_days: isNaN(Number(data.safety_stock_days)) ? 30 : Number(data.safety_stock_days),
      source_type: data.source_type || "local",
      material_classification: data.material_classification || "RM",
      status: data.status || "active",
      updated_at: new Date().toISOString()
    };

    await sbWrite("material_master", [record], {
      prefer: "resolution=merge-duplicates",
    });

    revalidatePath("/deep-dive");
    revalidatePath("/mrp");
    return { success: true };
  } catch (e) {
    console.error("saveMaterialMaster error:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Deletes a material from the material_master table.
 */
export async function deleteMaterialMaster(materialName) {
  try {
    const compUpper = String(materialName).trim();
    await sbWrite(`material_master?material_name=eq.${encodeURIComponent(compUpper)}`, null, {
      method: "DELETE",
    });

    revalidatePath("/deep-dive");
    revalidatePath("/mrp");
    return { success: true };
  } catch (e) {
    console.error("deleteMaterialMaster error:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Bulk upserts an array of parsed material records into material_master.
 */
export async function bulkUploadMaterialMaster(rows) {
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, error: "No records found to upload" };
    }

    const records = rows.map((r) => ({
      material_name: String(r.material_name || "").trim(),
      vendor_name: r.vendor_name || null,
      lead_time_days: isNaN(Number(r.lead_time_days)) ? 14 : Number(r.lead_time_days),
      moq: isNaN(Number(r.moq)) ? 0 : Number(r.moq),
      safety_stock_days: isNaN(Number(r.safety_stock_days)) ? 30 : Number(r.safety_stock_days),
      source_type: String(r.source_type || "local").trim().toLowerCase() === "import" ? "import" : "local",
      material_classification: String(r.material_classification || "RM").trim().toUpperCase() === "PM" ? "PM" : "RM",
      status: String(r.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
      updated_at: new Date().toISOString()
    })).filter(r => r.material_name !== "");

    if (records.length === 0) {
      return { success: false, error: "No valid records with Material Name found" };
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE);
      await sbWrite("material_master", chunk, {
        prefer: "resolution=merge-duplicates",
      });
    }

    revalidatePath("/deep-dive");
    revalidatePath("/mrp");
    return { success: true, count: records.length };
  } catch (e) {
    console.error("bulkUploadMaterialMaster error:", e);
    return { success: false, error: e.message };
  }
}

