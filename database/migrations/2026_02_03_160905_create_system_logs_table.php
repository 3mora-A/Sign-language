<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;


return new class extends Migration {
public function up(): void {
Schema::create('system_logs', function (Blueprint $table) {
$table->id();
$table->foreignId('video_id')->nullable()->constrained()->onDelete('cascade');
$table->text('message');
$table->timestamps();
});
}


public function down(): void {
Schema::dropIfExists('system_logs');
}
};
