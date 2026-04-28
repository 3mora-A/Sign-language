<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;



return new class extends Migration {
public function up(): void {
Schema::create('gestures', function (Blueprint $table) {
$table->id();
$table->string('label');
$table->text('description')->nullable();
$table->enum('language', ['PSL', 'ArSL']);
$table->timestamps();
});
}


public function down(): void {
Schema::dropIfExists('gestures');
}
};
