<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;


return new class extends Migration {
public function up(): void {
Schema::create('datasets', function (Blueprint $table) {
$table->id();
$table->string('video_path');
$table->foreignId('gesture_id')->constrained()->onDelete('cascade');
$table->foreignId('emotion_id')->constrained()->onDelete('cascade');
$table->string('annotated_by');
$table->timestamps();
});
}


public function down(): void {
Schema::dropIfExists('datasets');
}
};
