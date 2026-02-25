<?php

namespace Drupal\nyx_chat_assistant\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Drupal\nyx_chat_assistant\Service\N8nClient;

class ChatController extends ControllerBase implements ContainerInjectionInterface {

  protected N8nClient $n8nClient;

  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('nyx_chat_assistant.n8n_client')
    );
  }

  public function __construct(N8nClient $n8n_client) {
    $this->n8nClient = $n8n_client;
  }

  protected function corsHeaders(): array {
    return [
      'Access-Control-Allow-Origin' => '*',
      'Access-Control-Allow-Methods' => 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers' => 'Content-Type',
    ];
  }

  public function options(): JsonResponse {
    return new JsonResponse(null, 200, $this->corsHeaders());
  }

  public function chat(Request $request): JsonResponse {
    $content = $request->getContent() ?: '';
    $requestData = json_decode($content, true);
    if (!is_array($requestData)) {
      $requestData = [];
    }

    $message = $requestData['message'] ?? null;
    if (!$message) {
      return new JsonResponse(['error' => 'Mensagem não fornecida'], 400, $this->corsHeaders());
    }

    $sessionId = $requestData['sessionId'] ?? (string) time();

    try {
      $result = $this->n8nClient->sendMessage($message, $sessionId);
      if (!$result['success']) {
        return new JsonResponse([
          'success' => false,
          'error' => $result['error'] ?? 'Erro ao comunicar com N8N',
          'reply' => $result['reply'] ?? 'Desculpe, ocorreu um erro. Tente novamente.',
        ], 502, $this->corsHeaders());
      }

      return new JsonResponse([
        'success' => true,
        'reply' => $result['reply'],
        'sessionId' => $result['sessionId'],
      ], 200, $this->corsHeaders());
    }
    catch (\Throwable $e) {
      return new JsonResponse([
        'success' => false,
        'error' => 'Erro ao comunicar com N8N: ' . $e->getMessage(),
        'reply' => 'Desculpe, ocorreu um erro. Tente novamente.',
      ], 500, $this->corsHeaders());
    }
  }
}
