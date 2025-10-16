<?php

namespace Dmkulyk\NovaValidationToast;

use Illuminate\Support\ServiceProvider;
use Laravel\Nova\Events\ServingNova;
use Laravel\Nova\Nova;

class NovaValidationToastServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        Nova::serving(function (ServingNova $event) {
            Nova::script(
                'nova-validation-toast',
                __DIR__.'/../resources/js/nova-validation-toast.js'
            );
        });

        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__.'/../resources/js/nova-validation-toast.js' => public_path('vendor/nova-validation-toast/nova-validation-toast.js'),
            ], 'nova-validation-toast-assets');
        }
    }

    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }
}