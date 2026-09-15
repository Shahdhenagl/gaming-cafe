<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Device extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_name',
        'room_name_ar',
        'device_name',
        'device_name_ar',
        'device_type',
        'status',
        'location',
        'hourly_rate',
        'specs',
    ];

    protected $casts = [
        'hourly_rate' => 'float',
    ];

    public function sessions()
    {
        return $this->hasMany(DeviceSession::class, 'device_id');
    }

    public function activeSession()
    {
        return $this->hasOne(DeviceSession::class, 'device_id')
            ->where('status', 'active')
            ->latestOfMany();
    }
}
