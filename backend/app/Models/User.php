<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'pin_code',
        'phone',
        'role',
        'shift_id',
        'avatar',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function currentShift()
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    public function shifts()
    {
        return $this->hasMany(Shift::class, 'staff_id');
    }

    public function sessions()
    {
        return $this->hasMany(DeviceSession::class, 'staff_id');
    }

    public function orders()
    {
        return $this->hasMany(Order::class, 'staff_id');
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isManager(): bool
    {
        return in_array($this->role, ['admin', 'manager']);
    }
}
