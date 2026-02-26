<?php

namespace Drupal\nyx_chat_assistant\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Drupal\nyx_chat_assistant\Service\N8nClient;
use Drupal\Core\State\StateInterface;

class ChatController extends ControllerBase implements ContainerInjectionInterface {

  protected N8nClient $n8nClient;
  protected StateInterface $state;

  // Rate limiting: máximo de requisições por minuto
  const RATE_LIMIT = 20;
  const RATE_WINDOW = 60; // segundos

  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('nyx_chat_assistant.n8n_client'),
      $container->get('state')
    );
  }

  public function __construct(N8nClient $n8n_client, StateInterface $state) {
    $this->n8nClient = $n8n_client;
    $this->state = $state;
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
    // Verificar rate limit
    $clientIp = $request->getClientIp();
    if (!$this->checkRateLimit($clientIp)) {
      \Drupal::logger('nyx_chat_assistant')->warning('Rate limit excedido para IP: @ip', ['@ip' => $clientIp]);
      return new JsonResponse([
        'error' => 'Muitas requisições. Tente novamente em alguns momentos.',
        'success' => false,
      ], 429, $this->corsHeaders());
    }

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

  /**
   * Verifica rate limit por IP.
   *
   * @param string $ip
   *   Endereço IP do cliente.
   *
   * @return bool
   *   TRUE se dentro do limite, FALSE se excedeu.
   */
  protected function checkRateLimit(string $ip): bool {
    $key = 'chat_rate_limit:' . md5($ip);
    $now = time();

    // Obter dados de rate limit
    $data = $this->state->get($key, ['count' => 0, 'window_start' => $now]);

    // Se passou a janela de tempo, resetar
    if (($now - $data['window_start']) >= self::RATE_WINDOW) {
      $data = ['count' => 1, 'window_start' => $now];
      $this->state->set($key, $data);
      return TRUE;
    }

    // Verificar se excedeu o limite
    if ($data['count'] >= self::RATE_LIMIT) {
      return FALSE;
    }

    // Incrementar contador
    $data['count']++;
    $this->state->set($key, $data);
    return TRUE;
  }
}
