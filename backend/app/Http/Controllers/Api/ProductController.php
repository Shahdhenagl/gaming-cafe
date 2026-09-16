<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryLog;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    /**
     * List products with category filter and search.
     */
    public function index(Request $request)
    {
        $query = Product::query();

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('name_ar', 'like', "%{$s}%");
            });
        }

        $products = $query->orderBy('category')->orderBy('name')->get();

        $categories = [
            'all' => 'All Items',
            'hot_drinks' => 'Hot Coffee & Tea',
            'cold_drinks' => 'Iced & Cold Brews',
            'soft_drinks' => 'Energy & Soft Drinks',
            'snacks' => 'Snacks & Bites',
            'food' => 'Sandwiches & Waffles',
        ];

        return response()->json([
            'products' => $products,
            'categories' => $categories,
            'summary' => [
                'total_products' => $products->count(),
                'low_stock_count' => $products->filter(fn($p) => $p->isLowStock())->count(),
            ]
        ]);
    }

    /**
     * Store new product.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'category' => 'required|in:hot_drinks,cold_drinks,soft_drinks,snacks,food',
            'price' => 'required|numeric|min:0',
            'cost_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'required|integer|min:0',
            'reorder_level' => 'nullable|integer|min:0',
            'image_url' => 'nullable|string',
        ]);

        $product = Product::create($validated);

        if ($product->stock_quantity > 0) {
            InventoryLog::create([
                'product_id' => $product->id,
                'quantity_change' => $product->stock_quantity,
                'reason' => 'restock',
                'staff_id' => $request->user() ? $request->user()->id : null,
            ]);
        }

        return response()->json([
            'message' => 'Product added successfully',
            'product' => $product,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'name_ar' => 'sometimes|string|max:255',
            'category' => 'sometimes|in:hot_drinks,cold_drinks,soft_drinks,snacks,food',
            'price' => 'sometimes|numeric|min:0',
            'cost_price' => 'sometimes|numeric|min:0',
            'stock_quantity' => 'sometimes|integer|min:0',
            'reorder_level' => 'sometimes|integer|min:0',
        ]);
        $product->update($validated);
        return response()->json(['message' => 'Product updated successfully', 'product' => $product]);
    }

    public function destroy($id)
    {
        $product = Product::findOrFail($id);
        $product->delete();

        return response()->json(['message' => 'Product deleted successfully']);
    }

    /**
     * Adjust product stock (Restock or Adjustment).
     */
    public function updateStock(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        $request->validate([
            'quantity_change' => 'required|integer',
            'reason' => 'required|in:restock,adjustment,sale',
        ]);

        $change = (int)$request->quantity_change;
        $newStock = max(0, $product->stock_quantity + $change);

        $product->update(['stock_quantity' => $newStock]);

        InventoryLog::create([
            'product_id' => $product->id,
            'quantity_change' => $change,
            'reason' => $request->reason,
            'staff_id' => $request->user() ? $request->user()->id : null,
        ]);

        return response()->json([
            'message' => 'Stock updated successfully',
            'product' => $product,
        ]);
    }

    /**
     * Get inventory logs.
     */
    public function inventoryReport()
    {
        $logs = InventoryLog::with(['product', 'staff'])
            ->latest()
            ->take(50)
            ->get();

        $lowStockProducts = Product::whereColumn('stock_quantity', '<=', 'reorder_level')->get();

        return response()->json([
            'logs' => $logs,
            'low_stock_products' => $lowStockProducts,
        ]);
    }
}
