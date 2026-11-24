<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/app/Config/bootstrap.php';

use Ccm\Cinematic\Controller\TrackController;

(new TrackController())->handle();
