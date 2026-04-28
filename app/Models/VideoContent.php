<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VideoContent extends Model
{
    protected $fillable = [
        'video_id',
        'media_base64',
        'checksum_sha256',
    ];

    public function video(): BelongsTo
    {
        return $this->belongsTo(Video::class);
    }
}
