<?php

use Illuminate\Database\Migrations\Migration;
return new class extends Migration {
    public function up(): void
    {
        // Emotion-only application: no legacy tables are created on new installs.
    }

    public function down(): void
    {
        //
    }
};
