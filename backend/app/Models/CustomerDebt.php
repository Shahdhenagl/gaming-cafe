<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class CustomerDebt extends Model {
    protected $fillable = ['customer_id','order_id','device_session_id','shift_id','amount','paid_amount','description','status'];
    protected $casts = ['amount'=>'float','paid_amount'=>'float'];
    protected $appends = ['remaining_amount'];
    public function customer() { return $this->belongsTo(Customer::class); }
    public function order() { return $this->belongsTo(Order::class); }
    public function deviceSession() { return $this->belongsTo(DeviceSession::class); }
    public function payments() { return $this->hasMany(CustomerDebtPayment::class); }
    public function getRemainingAmountAttribute() { return round(max(0, (float)$this->amount - (float)$this->paid_amount), 2); }
}
