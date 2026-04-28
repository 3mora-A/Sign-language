<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('video_contents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('video_id')->unique()->constrained()->onDelete('cascade');
            $table->longText('media_base64');
            $table->string('checksum_sha256', 64)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('video_contents');
    }
};
