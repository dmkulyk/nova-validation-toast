<?php

namespace Dmkulyk\NovaValidationToast;

use Illuminate\Support\ServiceProvider;

class NovaValidationToastServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        // Only register Nova functionality if Nova is installed
        if (class_exists('Laravel\Nova\Nova')) {
            $this->bootNova();
        }

        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__.'/../resources/js/nova-validation-toast.js' => public_path('vendor/nova-validation-toast/nova-validation-toast.js'),
            ], 'nova-validation-toast-assets');
        }
    }

    /**
     * Boot Nova-specific functionality.
     *
     * @return void
     */
    protected function bootNova()
    {
        $novaClass = 'Laravel\Nova\Nova';
        $servingNovaClass = 'Laravel\Nova\Events\ServingNova';

        $novaClass::serving(function ($event) use ($novaClass) {
            $novaClass::script(
                'nova-validation-toast',
                __DIR__.'/../resources/js/nova-validation-toast.js'
            );
        });
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