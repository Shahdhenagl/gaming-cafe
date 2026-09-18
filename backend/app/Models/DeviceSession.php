<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeviceSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'device_id',
        'shift_id',
        'staff_id',
        'customer_name',
        'customer_phone',
        'start_time',
        'end_time',
        'duration_minutes',
        'is_open_ended',
        'status',
        'hourly_rate',
        'session_cost',
        'beverage_cost',
        'discount',
        'total_amount',
        'paid_amount',
        'payment_status',
        'payment_method',
    ];

    protected $casts = [
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'is_open_ended' => 'boolean',
        'hourly_rate' => 'float',
        'hourly_rate' => 'float',
        'session_cost' => 'float',
        'beverage_cost' => 'float',
        'discount' => 'float',
        'total_amount' => 'float',
        'paid_amount' => 'float',
    ];

    public function device()
    {
        return $this->belongsTo(Device::class, 'device_id');
    }

    public function shift()
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    public function extensions()
    {
        return $this->hasMany(SessionExtension::class, 'session_id');
    }

    public function orders()
    {
        return $this->hasMany(Order::class, 'device_session_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'device_session_id');
    }
}
