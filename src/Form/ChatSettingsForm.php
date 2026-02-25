<?php

namespace Drupal\nyx_chat_assistant\Form;

use Drupal\Core\Cache\CacheTagsInvalidatorInterface;
use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;

class ChatSettingsForm extends ConfigFormBase {

  /**
   * The cache tags invalidator service.
   *
   * @var \Drupal\Core\Cache\CacheTagsInvalidatorInterface
   */
  protected $cacheTagsInvalidator;

  /**
   * Constructs a ChatSettingsForm object.
   *
   * @param \Drupal\Core\Cache\CacheTagsInvalidatorInterface $cache_tags_invalidator
   *   The cache tags invalidator service.
   */
  public function __construct(CacheTagsInvalidatorInterface $cache_tags_invalidator) {
    $this->cacheTagsInvalidator = $cache_tags_invalidator;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('cache_tags.invalidator')
    );
  }

  protected function getEditableConfigNames() {
    return ['nyx_chat_assistant.settings'];
  }

  public function getFormId() {
    return 'nyx_chat_assistant_settings_form';
  }

  public function buildForm(array $form, FormStateInterface $form_state) {
    $config = $this->config('nyx_chat_assistant.settings');

    $form['#tree'] = TRUE;

    $form['enabled'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Enable widget'),
      '#default_value' => (bool) $config->get('enabled'),
      '#description' => $this->t('When disabled, the chat widget will not be attached to pages.'),
    ];

    $form['title'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Widget title'),
      '#default_value' => $config->get('title') ?: 'Chat de Atendimento',
    ];

    $form['bot_icon'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Bot icon (emoji)'),
      '#default_value' => $config->get('bot_icon') ?: '🤖',
      '#maxlength' => 2,
      '#description' => $this->t('Enter an emoji to represent the bot (e.g., 🤖, 💬, 👋, 🎯)'),
    ];

    $form['primary_color'] = [
      '#type' => 'color',
      '#title' => $this->t('Primary color'),
      '#default_value' => $config->get('primary_color') ?: '#99A1AF',
    ];

    $form['position'] = [
      '#type' => 'select',
      '#title' => $this->t('Position'),
      '#options' => [
        'bottom-right' => $this->t('Bottom right'),
        'bottom-left' => $this->t('Bottom left'),
        'top-right' => $this->t('Top right'),
        'top-left' => $this->t('Top left'),
      ],
      '#default_value' => $config->get('position') ?: 'bottom-right',
    ];

    $form['greeting'] = [
      '#type' => 'textarea',
      '#title' => $this->t('Greeting message'),
      '#default_value' => $config->get('greeting') ?: 'Olá! Como posso ajudar você hoje?',
    ];

    $form['placeholder'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Input placeholder'),
      '#default_value' => $config->get('placeholder') ?: 'Digite sua mensagem...',
    ];

    $form['message_format'] = [
      '#type' => 'select',
      '#title' => $this->t('Bot message format'),
      '#options' => [
        'markdown' => $this->t('Markdown'),
        'html' => $this->t('HTML (sanitized)'),
        'text' => $this->t('Plain text'),
      ],
      '#default_value' => $config->get('message_format') ?: 'markdown',
    ];

    return parent::buildForm($form, $form_state);
  }

  public function validateForm(array &$form, FormStateInterface $form_state) {
    parent::validateForm($form, $form_state);
    // O campo 'color' já valida o formato hexadecimal automaticamente
  }

  public function submitForm(array &$form, FormStateInterface $form_state) {
    parent::submitForm($form, $form_state);

    $this->configFactory->getEditable('nyx_chat_assistant.settings')
      ->set('enabled', (bool) $form_state->getValue('enabled'))
      ->set('title', $form_state->getValue('title'))
      ->set('bot_icon', $form_state->getValue('bot_icon'))
      ->set('primary_color', $form_state->getValue('primary_color'))
      ->set('position', $form_state->getValue('position'))
      ->set('greeting', $form_state->getValue('greeting'))
      ->set('placeholder', $form_state->getValue('placeholder'))
      ->set('message_format', $form_state->getValue('message_format'))
      ->save();

    // Invalida cache de páginas renderizadas para aplicar mudanças imediatamente
    $this->cacheTagsInvalidator->invalidateTags(['rendered']);
  }
}
