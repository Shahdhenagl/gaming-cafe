<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class CustomerDebtPayment extends Model {
    protected $fillable = ['customer_debt_id','amount','payment_method','staff_id','notes'];
    protected $casts = ['amount'=>'float'];
    public function debt() { return $this->belongsTo(CustomerDebt::class, 'customer_debt_id'); }
}
