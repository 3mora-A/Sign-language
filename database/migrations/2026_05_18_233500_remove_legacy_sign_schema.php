<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('predictions') && Schema::hasColumn('predictions', 'gesture_id')) {
            Schema::table('predictions', function (Blueprint $table) {
                $table->dropForeign(['gesture_id']);
            });

            Schema::table('predictions', function (Blueprint $table) {
                $table->dropColumn('gesture_id');
            });
        }

        if (Schema::hasTable('predictions') && Schema::hasColumn('predictions', 'gesture_alternatives')) {
            Schema::table('predictions', function (Blueprint $table) {
                $table->dropColumn('gesture_alternatives');
            });
        }

        if (Schema::hasTable('datasets')) {
            Schema::drop('datasets');
        }

        if (Schema::hasTable('gestures')) {
            Schema::drop('gestures');
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('gestures')) {
            Schema::create('gestures', function (Blueprint $table) {
                $table->id();
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('datasets')) {
            Schema::create('datasets', function (Blueprint $table) {
                $table->id();
                $table->string('video_path');
                $table->foreignId('gesture_id')->nullable()->constrained('gestures')->nullOnDelete();
                $table->foreignId('emotion_id')->constrained()->onDelete('cascade');
                $table->string('annotated_by');
                $table->timestamps();
            });
        }

        if (Schema::hasTable('predictions') && !Schema::hasColumn('predictions', 'gesture_id')) {
            Schema::table('predictions', function (Blueprint $table) {
                $table->foreignId('gesture_id')->nullable()->after('video_id')->constrained('gestures')->nullOnDelete();
            });
        }

        if (Schema::hasTable('predictions') && !Schema::hasColumn('predictions', 'gesture_alternatives')) {
            Schema::table('predictions', function (Blueprint $table) {
                $table->json('gesture_alternatives')->nullable()->after('emotion_source');
            });
        }
    }
};
