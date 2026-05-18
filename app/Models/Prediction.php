<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Prediction extends Model
{
    protected $fillable = [
        'video_id',
        'emotion_id',
        'confidence',
        'emotion_confidence',
        'frames_analyzed',
        'latency_ms',
        'emotion_source',
        'emotion_top_predictions',
        'raw_response',
    ];

    protected $casts = [
        'confidence' => 'float',
        'emotion_confidence' => 'float',
        'frames_analyzed' => 'integer',
        'latency_ms' => 'integer',
        'emotion_top_predictions' => 'array',
        'raw_response' => 'array',
    ];

    public function video(): BelongsTo
    {
        return $this->belongsTo(Video::class);
    }

    public function emotion(): BelongsTo
    {
        return $this->belongsTo(Emotion::class);
    }
}
