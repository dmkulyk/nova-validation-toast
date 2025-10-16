<?php

namespace Dmkulyk\NovaValidationToast\Tests;

class ServiceProviderTest extends TestCase
{
    /** @test */
    public function it_loads_the_service_provider()
    {
        $this->assertTrue(
            class_exists(\Dmkulyk\NovaValidationToast\NovaValidationToastServiceProvider::class)
        );
    }

    /** @test */
    public function it_can_resolve_the_service_provider()
    {
        $provider = $this->app->getProvider(\Dmkulyk\NovaValidationToast\NovaValidationToastServiceProvider::class);

        $this->assertInstanceOf(
            \Dmkulyk\NovaValidationToast\NovaValidationToastServiceProvider::class,
            $provider
        );
    }
}
