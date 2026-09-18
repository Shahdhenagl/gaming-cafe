<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TreasuryEntry extends Model
{
    protected $fillable = [
        'shift_id', 'staff_id', 'entry_type', 'payment_method', 'amount',
        'transaction_date', 'reference', 'notes',
    ];

    protected $casts = [
        'amount' => 'float',
        'transaction_date' => 'datetime',
    ];
}
