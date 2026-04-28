<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class RegisterController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:6|confirmed',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => 'user',
            'preferred_language' => $request->input('preferred_language', 'ar'),
        ]);

        Auth::login($user);

        if ($request->expectsJson()) {
            return response()->json([
                'ok' => true,
                'message' => 'تم إنشاء الحساب بنجاح.',
                'redirect' => '/upload',
            ]);
        }

        return redirect('/upload')->with('success', 'تم إنشاء الحساب بنجاح!');
    }
}
