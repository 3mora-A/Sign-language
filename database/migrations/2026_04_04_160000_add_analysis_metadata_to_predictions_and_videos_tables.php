<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('videos', function (Blueprint $table) {
            $table->text('error_message')->nullable()->after('result');
        });

        Schema::table('predictions', function (Blueprint $table) {
            $table->float('emotion_confidence')->nullable()->after('confidence');
            $table->unsignedInteger('frames_analyzed')->nullable()->after('emotion_confidence');
            $table->unsignedInteger('latency_ms')->nullable()->after('frames_analyzed');
            $table->string('emotion_source')->nullable()->after('latency_ms');
            $table->json('emotion_top_predictions')->nullable()->after('emotion_source');
            $table->json('raw_response')->nullable()->after('emotion_top_predictions');
        });
    }

    public function down(): void
    {
        Schema::table('predictions', function (Blueprint $table) {
            $table->dropColumn([
                'emotion_confidence',
                'frames_analyzed',
                'latency_ms',
                'emotion_source',
                'emotion_top_predictions',
                'raw_response',
            ]);
        });

        Schema::table('videos', function (Blueprint $table) {
            $table->dropColumn('error_message');
        });
    }
};
