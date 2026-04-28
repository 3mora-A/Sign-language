<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LoginController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $remember = $request->boolean('remember');

        if (Auth::attempt($credentials, $remember)) {
            $request->session()->regenerate();

            $redirect = auth()->user()->role === 'admin'
                ? '/admin/dashboard'
                : '/upload';

            if ($request->expectsJson()) {
                return response()->json([
                    'ok' => true,
                    'message' => 'تم تسجيل الدخول بنجاح.',
                    'redirect' => $redirect,
                ]);
            }

            return redirect()->intended($redirect);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'ok' => false,
                'message' => 'بيانات الدخول غير صحيحة.',
            ], 422);
        }

        return back()->with('error', 'بيانات الدخول غير صحيحة.');
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->expectsJson()) {
            return response()->json([
                'ok' => true,
                'redirect' => '/login',
            ]);
        }

        return redirect('/login');
    }
}
