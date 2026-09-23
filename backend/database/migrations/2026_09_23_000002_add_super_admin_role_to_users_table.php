<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role VARCHAR(30) NOT NULL DEFAULT 'staff'");
        } elseif ($driver === 'pgsql') {
            // Drop enum check if any or convert role to varchar(50)
            try {
                DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
            } catch (\Throwable $e) {}
            DB::statement("ALTER TABLE users ALTER COLUMN role TYPE varchar(50)");
            DB::statement("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'staff'");
        } elseif ($driver === 'sqlite') {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role', 30)->default('staff')->change();
            });
        }
    }

    public function down(): void
    {
        // Safe rollback - keep varchar or enum
    }
};
