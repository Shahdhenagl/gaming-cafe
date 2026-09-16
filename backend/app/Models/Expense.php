<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use HasFactory;

    protected $fillable = ['shift_id', 'staff_id', 'category', 'description', 'amount', 'expense_date', 'notes'];

    protected $casts = ['amount' => 'float', 'expense_date' => 'date'];

    public function shift() { return $this->belongsTo(Shift::class); }
    public function staff() { return $this->belongsTo(User::class, 'staff_id'); }
}
