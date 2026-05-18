<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;



return new class extends Migration {
public function up(): void {
Schema::create('predictions', function (Blueprint $table) {
$table->id();
$table->foreignId('video_id')->constrained()->onDelete('cascade');
$table->foreignId('emotion_id')->constrained()->onDelete('cascade');
$table->float('confidence');
$table->timestamps();
});
}


public function down(): void {
Schema::dropIfExists('predictions');
}
};
