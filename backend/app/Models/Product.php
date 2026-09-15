<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'name_ar',
        'category',
        'price',
        'cost_price',
        'stock_quantity',
        'reorder_level',
        'image_url',
        'supplier_id',
    ];

    protected $casts = [
        'price' => 'float',
        'cost_price' => 'float',
        'stock_quantity' => 'integer',
        'reorder_level' => 'integer',
    ];

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'product_id');
    }

    public function inventoryLogs()
    {
        return $this->hasMany(InventoryLog::class, 'product_id');
    }

    public function isLowStock(): bool
    {
        return $this->stock_quantity <= $this->reorder_level;
    }
}
