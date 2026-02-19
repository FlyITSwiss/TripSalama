<?php

declare(strict_types=1);

namespace TripSalama\Controllers;

use PDO;
use TripSalama\Helpers\PathHelper;

/**
 * Controller pour le mode demo
 */
class DemoController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Page de demonstration du tracking vehicule
     */
    public function tracking(): void
    {
        $this->render('demo/tracking', [
            'pageTitle' => __('demo.title'),
            'includeMap' => true,
            'pageCss' => ['tripsalama-demo.css'],
            'pageJs' => ['modules/map-controller.js', 'modules/demo-mode.js'],
            'bodyClass' => 'page-demo',
        ]);
    }

    /**
     * Page de test du tracking Uber-style (standalone)
     */
    public function trackingTest(): void
    {
        $viewPath = PathHelper::getViewsPath() . '/test/tracking-demo.phtml';

        if (!file_exists($viewPath)) {
            throw new \Exception("View not found: test/tracking-demo");
        }

        require $viewPath;
    }

    /**
     * Rendre une vue
     */
    private function render(string $view, array $data = []): void
    {
        extract($data);

        $viewPath = PathHelper::getViewsPath() . '/' . $view . '.phtml';

        if (!file_exists($viewPath)) {
            throw new \Exception("View not found: $view");
        }

        ob_start();
        require $viewPath;
        $content = ob_get_clean();

        require PathHelper::getViewsPath() . '/layouts/main.phtml';
    }
}
