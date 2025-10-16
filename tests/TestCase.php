<?php

namespace Dmkulyk\NovaValidationToast\Tests;

use Dmkulyk\NovaValidationToast\NovaValidationToastServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;

class TestCase extends Orchestra
{
    protected function setUp(): void
    {
        parent::setUp();
    }

    protected function getPackageProviders($app)
    {
        return [
            NovaValidationToastServiceProvider::class,
        ];
    }
}