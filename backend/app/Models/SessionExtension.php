<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SessionExtension extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'added_minutes',
        'price',
        'requested_at',
        'applied_at',
        'staff_id',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'applied_at' => 'datetime',
        'price' => 'float',
    ];

    public function session()
    {
        return $this->belongsTo(DeviceSession::class, 'session_id');
    }

    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id');
    }
}
