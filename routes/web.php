<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

Route::get('/', [SpaController::class, 'show'])->name('home');

Route::middleware('guest')->group(function () {
    Route::get('/login', [SpaController::class, 'show'])->name('login');
    Route::get('/register', [SpaController::class, 'show'])->name('register');
    Route::get('/forgot-password', [SpaController::class, 'show'])->name('password.request');
    Route::get('/reset-password', [SpaController::class, 'show'])->name('password.reset');
    Route::get('/verify-email', [SpaController::class, 'show'])->name('verification.notice');

    Route::post('/login', [LoginController::class, 'login']);
    Route::post('/register', [RegisterController::class, 'register']);
});

Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth')->name('logout');

Route::middleware('auth')->group(function () {
    Route::get('/upload', [SpaController::class, 'show'])->name('upload.form');
    Route::post('/upload', [MediaController::class, 'upload'])->name('upload.media');
    Route::get('/media/{video}/preview', [MediaController::class, 'preview'])->name('media.preview');
    Route::get('/live', [SpaController::class, 'show'])->name('live');
    Route::get('/results', [SpaController::class, 'show'])->name('results');
    Route::get('/history', [SpaController::class, 'show'])->name('history');
    Route::get('/settings', [SpaController::class, 'show'])->name('settings');
    Route::get('/profile', [SpaController::class, 'show'])->name('profile');
});

Route::middleware(['auth', \App\Http\Middleware\AdminMiddleware::class])->prefix('admin')->group(function () {
    Route::get('/dashboard', [SpaController::class, 'show'])->name('admin.dashboard');
});
