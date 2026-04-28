<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Video extends Model
{
    protected $fillable = [
        'user_id',
        'video_path',
        'storage_disk',
        'original_name',
        'mime_type',
        'file_size',
        'duration',
        'fps',
        'status',
        'result',
        'error_message',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function prediction(): HasOne
    {
        return $this->hasOne(Prediction::class);
    }

    public function mediaContent(): HasOne
    {
        return $this->hasOne(VideoContent::class);
    }
}
