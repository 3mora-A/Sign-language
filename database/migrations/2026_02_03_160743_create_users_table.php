<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;


return new class extends Migration {
public function up(): void {
Schema::create('users', function (Blueprint $table) {
$table->id();
$table->string('name');
$table->string('email')->unique();
$table->timestamp('email_verified_at')->nullable(); // ✅ لازم لإصلاح الخطأ
$table->string('password');
$table->rememberToken();                            // ✅ للـ Auth sessions
$table->enum('role', ['admin', 'user'])->default('user');
$table->enum('preferred_language', ['ar', 'en'])->default('ar');
$table->timestamps();

});
}


public function down(): void {
Schema::dropIfExists('users');
}
};
