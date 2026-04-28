<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Gesture extends Model
{
    protected $fillable = [
        'label',
        'description',
        'language',
    ];

    public function predictions(): HasMany
    {
        return $this->hasMany(Prediction::class);
    }
}
