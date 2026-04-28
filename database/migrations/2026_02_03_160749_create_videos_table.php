<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('videos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('video_path');
            $table->float('duration')->default(0);
            $table->integer('fps')->default(24);
            
            // الحالة 'processing' ضرورية لمنع خطأ Data truncated
            $table->enum('status', ['uploaded', 'processing', 'processed', 'failed'])->default('uploaded');
            
            // أضفت لك هذا العمود لتخزين نتيجة التوقع (مثل: fine, hello, etc)
            $table->string('result')->nullable(); 
            
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('videos');
    }
};