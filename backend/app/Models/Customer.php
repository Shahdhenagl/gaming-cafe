<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Customer extends Model {
    protected $fillable = ['name', 'phone', 'notes', 'is_archived'];
    protected $casts = [
        'is_archived' => 'boolean',
    ];
    public function debts() { return $this->hasMany(CustomerDebt::class); }
}
