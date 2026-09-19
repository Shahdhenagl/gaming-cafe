<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'device_session_id',
        'shift_id',
        'amount',
        'payment_method',
        'reference_id',
        'status',
    ];

    protected $casts = [
        'amount' => 'float',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    public function deviceSession()
    {
        return $this->belongsTo(DeviceSession::class, 'device_session_id');
    }
}
