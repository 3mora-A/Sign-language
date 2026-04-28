<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Emotion extends Model
{
    protected $fillable = [
        'name',
        'arabic_name',
    ];

    public function predictions(): HasMany
    {
        return $this->hasMany(Prediction::class);
    }
}
