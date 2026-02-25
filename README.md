# Módulo: Nyx Chat Assistant

**Versão:** 1.0.0
**Autor:** Nyx

---

## Sumário

1.  [Visão Geral](#1-visão-geral)
2.  [Funcionalidades](#2-funcionalidades)
3.  [Instalação e Configuração](#3-instalação-e-configuração)
4.  [Detalhes Técnicos](#4-detalhes-técnicos)

---

## 1. Visão Geral

O módulo **Nyx Chat Assistant** adiciona um widget de chat interativo ao site. Ele foi projetado para permitir que usuários anônimos interajam com um assistente virtual, que é alimentado por um serviço externo (como o N8N).

O módulo fornece um bloco de chat flutuante, cuja aparência e comportamento podem ser totalmente personalizados através da interface administrativa do Drupal.

---

## 2. Funcionalidades

-   **Widget de Chat Flutuante:** Exibe um ícone de chat que, ao ser clicado, abre uma janela de conversação.
-   **Alta Customização:** Permite configurar título, cor, posição na tela, mensagem de saudação e texto de placeholder.
-   **Proxy de API:** Fornece um endpoint de API (`/api/chat`) que atua como um proxy seguro entre o frontend do widget e o serviço de webhook externo (N8N), evitando a exposição direta da URL do webhook.
-   **Habilitação Condicional:** O widget só é carregado para usuários anônimos e pode ser facilmente habilitado ou desabilitado nas configurações.
-   **Formatação de Mensagens:** Suporta mensagens formatadas em Markdown, HTML ou texto simples.

---

## 3. Instalação e Configuração

### Pré-requisitos

Antes de instalar, certifique-se de que a URL do webhook do N8N está configurada no seu arquivo `.env`. Esta configuração é essencial para o funcionamento do chat.

Adicione a seguinte linha ao seu arquivo `.env`:
```
N8N_WEBHOOK_URL="SUA_URL_DE_WEBHOOK_AQUI"
```
Esta variável de ambiente é lida diretamente pelo módulo e **não pode** ser configurada pela interface do Drupal por motivos de segurança.

### Instalação

1.  Instale o módulo como qualquer outro módulo Drupal (via UI ou Drush).
2.  Execute o comando:
    ```bash
    drush en nyx_chat_assistant
    ```
3.  Execute as atualizações do banco de dados para importar as traduções pt-BR:
    ```bash
    drush updb -y
    ```

**Nota:** Caso as traduções não sejam aplicadas automaticamente ou você precise reimportá-las manualmente, execute:
```bash
drush locale-import pt-br ../web/modules/custom/nyx_chat_assistant/translations/nyx_chat_assistant.pt-br.po
```

### Configuração

1.  Após a instalação, navegue até a página de configurações do módulo:
    *Administração > Configuração > Sistema > Nyx Chat Assistant*
    (ou acesse diretamente via `/admin/config/system/nyx-chat-assistant`).

2.  Preencha os seguintes campos:
    -   **Enable widget:** Marque esta caixa para ativar o widget no site.
    -   **Widget title:** O título que aparecerá no cabeçalho do chat.
    -   **Primary color:** A cor principal do widget (em formato hexadecimal, ex: `#0066CC`).
    -   **Position:** A posição do widget na tela (ex: Canto inferior direito).
    -   **Greeting message:** A primeira mensagem que o usuário verá ao abrir o chat.
    -   **Input placeholder:** O texto exibido no campo de digitação.
    -   **Bot message format:** O formato esperado das respostas do bot.

3.  Salve as configurações. O widget de chat aparecerá para todos os usuários anônimos, contanto que a opção "Enable widget" esteja marcada.

**Importante:** O endpoint da API (`/api/chat`) e a URL do webhook do N8N não são mais configuráveis através da interface. O primeiro está fixo no código, e o segundo deve ser definido exclusivamente através da variável de ambiente `N8N_WEBHOOK_URL`.

---

## 4. Detalhes Técnicos

-   **Serviços:**
    -   `nyx_chat_assistant.n8n_client`: Serviço responsável pela comunicação com o webhook N8N.

-   **Controllers:**
    -   `ChatController.php`: Contém a lógica para o endpoint proxy (`/api/chat`). Ele recebe a mensagem do widget, a encaminha para o serviço N8N e retorna a resposta do bot para o frontend.

-   **JavaScript:**
    -   `js/widget.js`: Contém toda a lógica de frontend para renderizar o widget, gerenciar o estado da conversa e se comunicar com o endpoint `/api/chat`.

-   **Hooks:**
    -   `hook_page_attachments()`: Utilizado para anexar a biblioteca JavaScript e as configurações do widget (`drupalSettings.chatbotWidget`) a todas as páginas para usuários anônimos.
