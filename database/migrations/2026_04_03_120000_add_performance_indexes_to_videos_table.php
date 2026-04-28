<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('videos', function (Blueprint $table) {
            $table->index(['user_id', 'created_at'], 'videos_user_created_at_index');
            $table->index(['user_id', 'status'], 'videos_user_status_index');
            $table->index('status', 'videos_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('videos', function (Blueprint $table) {
            $table->dropIndex('videos_user_created_at_index');
            $table->dropIndex('videos_user_status_index');
            $table->dropIndex('videos_status_index');
        });
    }
};
