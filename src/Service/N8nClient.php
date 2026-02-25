<?php

namespace Drupal\nyx_chat_assistant\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use GuzzleHttp\ClientInterface;
use DateTime;

class N8nClient {
  private ClientInterface $httpClient;
  private ConfigFactoryInterface $configFactory;

  public function __construct(ClientInterface $http_client, ConfigFactoryInterface $config_factory) {
    $this->httpClient = $http_client;
    $this->configFactory = $config_factory;
  }

  /**
   * Envia a mensagem ao N8N e retorna uma resposta normalizada.
   *
   * @param string $message
   * @param string $sessionId
   *
   * @return array{success:bool, reply:?string, sessionId:?string, status:int, error:?string}
   */
  public function sendMessage(string $message, string $sessionId): array {
    // Lê exclusivamente do .env por segurança (não editável via painel admin)
    $webhook = getenv('N8N_WEBHOOK_URL');
    if (!$webhook || trim($webhook) === '') {
      throw new \RuntimeException('N8N webhook URL não configurada. Defina N8N_WEBHOOK_URL no arquivo .env');
    }

    $payload = json_encode([
      'message' => $message,
      'sessionId' => $sessionId,
      'timestamp' => (new DateTime())->format(DateTime::ATOM),
    ]);

    $response = $this->httpClient->request('POST', $webhook, [
      'headers' => ['Content-Type' => 'application/json'],
      'body' => $payload,
      'http_errors' => false,
      // 'timeout' => 15,
    ]);

    $status = $response->getStatusCode();
    $body = (string) $response->getBody();
    $data = json_decode($body, true);

    if ($status < 200 || $status >= 300) {
      return [
        'success' => false,
        'reply' => 'Desculpe, ocorreu um erro. Tente novamente.',
        'sessionId' => null,
        'status' => $status,
        'error' => 'Falha ao obter resposta do N8N (HTTP ' . $status . ')',
      ];
    }

    if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
      return [
        'success' => false,
        'reply' => 'Desculpe, ocorreu um erro. Tente novamente.',
        'sessionId' => null,
        'status' => 502,
        'error' => 'Resposta inválida do N8N',
      ];
    }

    return [
      'success' => true,
      'reply' => $data['output'] ?? $data['message'] ?? 'Nenhuma resposta gerada pelo assistente.',
      'sessionId' => $data['sessionId'] ?? null,
      'status' => $status,
      'error' => null,
    ];
  }
}
