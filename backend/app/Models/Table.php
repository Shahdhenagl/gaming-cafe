<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Table extends Model
{
    use HasFactory;

    protected $fillable = [
        'table_number',
        'capacity',
        'status',
        'occupied_at',
        'current_order_id',
        'total_spent',
    ];

    protected $casts = [
        'capacity' => 'integer',
        'occupied_at' => 'datetime',
        'total_spent' => 'float',
    ];

    public function orders()
    {
        return $this->hasMany(Order::class, 'table_id');
    }

    public function currentOrder()
    {
        return $this->belongsTo(Order::class, 'current_order_id');
    }
}
