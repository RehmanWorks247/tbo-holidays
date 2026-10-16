import type { PageMessages } from '../../page-english';
import { spanishPage } from './es';
import { portuguesePage } from './pt';

export const spanishArgentinaPage: PageMessages = {
  ...spanishPage,
  home: {
    ...spanishPage.home,
    search: {
      ...spanishPage.home.search,
      label: 'Encontrá tu hotel',
      findHappy: 'Encontrá tu felicidad',
      tagline: 'Tu próxima escapada empieza acá.',
      mobileLink: 'Encontrá tu próxima estadía',
    },
    hero: {
      ...spanishPage.home.hero,
      description: 'Grandes aventuras. Pequeñas escapadas.\nEncontrá una estadía que te encante.',
      badgeBottom: 'Grandes estadías.',
      beachDescription: 'Respondé con una escapada a la playa.',
    },
    inspiration: {
      ...spanishPage.home.inspiration,
      aside: 'Tenemos algo de inspiración para vos.',
      cityAction: 'Encontrá tu escapada urbana',
      farawayEyebrow: 'DEDICATE TIEMPO',
      farawayTitle: 'Hacé menos.\nDisfrutá más.',
      farawayAction: 'Descubrí destinos lejanos',
    },
    benefits: {
      ...spanishPage.home.benefits,
      getawayTitle: 'Encontrá tu escapada ideal',
      getawayDescription: 'De días de playa a estadías urbanas',
      pricingTitle: 'Informate antes de viajar',
      pricingDescription: 'Revisá el precio antes de reservar',
      staysTitle: 'Todas tus estadías, juntas',
    },
    destinations: {
      ...spanishPage.home.destinations,
      description: 'Hay lugares que se sienten como vacaciones. Encontrá el tuyo.',
      note: 'Ideas para tu próximo viaje. Buscá tus fechas para ver hoteles disponibles.',
    },
    saved: {
      ...spanishPage.home.saved,
      empty:
        '¿Encontraste un lugar que te encanta? Tocá el corazón para reunir tus ideas durante esta visita.',
    },
    escape: { ...spanishPage.home.escape, action: 'Encontremos tu estadía' },
    help: {
      ...spanishPage.home.help,
      title: '¿Todo listo para tu próxima estadía?',
      action: 'Empezá a explorar',
      searchAnswer:
        'Ingresá un código de destino, las fechas de entrada y salida y los huéspedes. Indicá la nacionalidad del huésped principal en el panel de huéspedes, elegí la moneda en el encabezado y seleccioná Buscar.',
      priceAnswer:
        'El precio y la disponibilidad se vuelven a comprobar antes de reservar. Podés revisar el total actualizado y las condiciones de cancelación antes de continuar.',
      roomsAnswer:
        'Podés buscar hasta cuatro habitaciones. Agregá los adultos, niños y sus edades en cada habitación para incluir a todos los viajeros.',
      bookingAnswer:
        'Iniciá sesión y abrí tus reservas para consultar la estadía y su estado. El hotel está confirmado cuando el estado de la reserva indica confirmación.',
    },
    dialog: {
      ...spanishPage.home.dialog,
      action: 'Planificá tu próxima estadía',
      note: 'Elegí el destino y las fechas para comprobar la disponibilidad de hoteles.',
    },
  },
  booking: {
    ...spanishPage.booking,
    details: {
      ...spanishPage.booking.details,
      reconciliation:
        'Tu reserva está en revisión. No hagas otro pago mientras la confirmación esté pendiente.',
    },
    list: {
      ...spanishPage.booking.list,
      emptyTitle: 'Tu próximo viaje empieza acá',
      emptyDescription: 'Tus reservas aparecerán acá cuando empieces una.',
    },
    price: {
      ...spanishPage.booking.price,
      totalDescription: 'Total de la estadía, incluidos los impuestos y cargos aplicables',
    },
    checkout: {
      ...spanishPage.booking.checkout,
      progressed:
        'Esta reserva ya superó la fase de datos de huéspedes. Abrí sus detalles para ver el estado actual.',
      savedGuests:
        'Los datos de los huéspedes están guardados. Retomá acá una reserva en curso si se interrumpió el pago.',
      statusUnavailable:
        'Consultá los detalles de la reserva para ver el estado actualizado del pago',
    },
    guests: {
      ...spanishPage.booking.guests,
      lastName: 'Apellido',
      emailError: 'Ingresá un email de contacto válido.',
      phoneError: 'Ingresá un teléfono de entre 5 y 30 caracteres.',
      firstNameError: 'Ingresá un nombre de entre 1 y 100 caracteres.',
      lastNameError: 'Ingresá un apellido de entre 1 y 100 caracteres.',
      titleError: 'Seleccioná un tratamiento válido.',
      detailsError: 'Revisá los datos. Exactamente un adulto debe ser el huésped principal.',
      guidance:
        'Escribí los nombres como aparecen en los documentos de viaje. El proveedor de pagos configurado gestiona el cobro.',
    },
    rate: {
      ...spanishPage.booking.rate,
      title: '1. Confirmá el precio actualizado',
      checkBeforeContinuing: 'Comprobá el precio actualizado antes de continuar.',
    },
  },
  results: {
    ...spanishPage.results,
    chooseSearch: 'Elegí destino, fechas y huéspedes para ver hoteles disponibles.',
    noHotels: 'No hay hoteles para esta búsqueda. Probá otras fechas o filtros.',
    fullStayFrom: 'Estadía completa desde',
    roomsForStay: 'Habitaciones para tu estadía',
    chooseDatesAndGuests: 'Elegí fechas y huéspedes para ver habitaciones disponibles.',
    stayTotal: 'Total de la estadía · confirmado al finalizar',
    noRooms: 'No hay habitaciones para estas fechas. Probá otra búsqueda.',
    lastName: 'Apellido',
    nameError: 'Ingresá un nombre de entre 1 y 100 caracteres.',
    phoneError: 'Ingresá un teléfono de entre 5 y 30 caracteres.',
    nationalityError: 'Ingresá un código de país de dos letras.',
  },
  app: {
    ...spanishPage.app,
    pageTitle: 'Best Holiday Packages · Encontrá tu próxima estadía',
    pageDescription: 'Descubrí tu próximo destino y encontrá un hotel con Best Holiday Packages.',
    languageDescription:
      'Elegí el idioma del sitio web, incluidas las páginas de búsqueda y reserva.',
    accountDescription: 'Tené listos tus datos de contacto para tu próxima estadía.',
    bookingsDescription: 'Revisá próximas estadías y seguí las actualizaciones de tus reservas.',
    checkoutDescription: 'Revisá el precio actualizado, agregá huéspedes y continuá al pago.',
    selectRoom: 'Seleccioná una habitación disponible para empezar.',
    hotelsDescription: 'Explorá habitaciones para tu estadía.',
    accountUnavailable:
      'Los servicios de cuenta y reserva estarán disponibles cuando se configure la autenticación. Podés seguir buscando hoteles.',
    errorDescription: 'Intentá cargar esta página de nuevo.',
    requestError:
      'No pudimos completar la solicitud. Si estabas reservando o pagando, comprobá el estado antes de intentarlo de nuevo.',
    serviceUnavailable: 'Este servicio no está disponible temporalmente. Intentá más tarde.',
    sessionExpired: 'Iniciá sesión para continuar.',
    accessDenied: 'No tenés acceso a esta página o reserva.',
    hotelUnavailable: 'Este hotel o habitación ya no está disponible. Buscá de nuevo.',
    rateExpired:
      'El precio o la disponibilidad cambiaron. Comprobá el precio actualizado antes de continuar.',
    quoteUsed: 'Este presupuesto ya se utilizó. Revisá tus reservas antes de crear otra.',
    bookingChanged: 'Esta reserva cambió. Abrí sus detalles para ver el estado actual.',
    guestDetailsError:
      'Comprobá que los huéspedes, edades y habitaciones coincidan con la reserva y que haya exactamente un adulto como huésped principal.',
    invalidStay: 'Elegí fechas de entrada y salida válidas y volvé a buscar.',
    unsupportedCurrency:
      'Esta moneda no es compatible con la reserva. Elegí otra y volvé a buscar.',
    paymentReview:
      'Se está comprobando el resultado del pago. No pagues de nuevo. Consultá tu reserva para ver las novedades.',
    confirmationPending:
      'La confirmación del hotel sigue pendiente. Consultá tu reserva antes de hacer otra.',
    cancellationUnavailable:
      'La cancelación online no está disponible. Contactá con asistencia para obtener ayuda.',
    inventoryUnavailable:
      'La disponibilidad de hoteles no está accesible ahora. Intentá más tarde.',
    validationError: 'Revisá los datos ingresados y volvé a intentarlo.',
  },
};

export const spanishMexicoPage: PageMessages = {
  ...spanishPage,
  home: {
    ...spanishPage.home,
    help: {
      ...spanishPage.home.help,
      searchAnswer:
        'Ingresa un código de destino, las fechas de entrada y salida y los huéspedes. Indica la nacionalidad del huésped principal en el panel de huéspedes, elige la moneda en el encabezado y selecciona Buscar.',
      roomsAnswer:
        'Puedes buscar hasta cuatro habitaciones. Agrega los adultos, niños y sus edades en cada habitación para incluir a todos los viajeros.',
    },
  },
  booking: {
    ...spanishPage.booking,
    guests: {
      ...spanishPage.booking.guests,
      lastName: 'Apellido',
      emailError: 'Ingresa un correo electrónico de contacto válido.',
      phoneError: 'Ingresa un teléfono de entre 5 y 30 caracteres.',
      firstNameError: 'Ingresa un nombre de entre 1 y 100 caracteres.',
      lastNameError: 'Ingresa un apellido de entre 1 y 100 caracteres.',
      contactEmail: 'Correo electrónico de contacto',
    },
  },
  results: {
    ...spanishPage.results,
    lastName: 'Apellido',
    nameError: 'Ingresa un nombre de entre 1 y 100 caracteres.',
    phoneError: 'Ingresa un teléfono de entre 5 y 30 caracteres.',
    nationalityError: 'Ingresa un código de país de dos letras.',
  },
  app: {
    ...spanishPage.app,
    checkoutDescription: 'Revisa el precio actualizado, agrega huéspedes y continúa al pago.',
    errorTitle: 'Algo salió mal',
    validationError: 'Revisa los datos ingresados y vuelve a intentarlo.',
  },
};

export const portugueseBrazilPage: PageMessages = {
  ...portuguesePage,
  home: {
    ...portuguesePage.home,
    search: {
      ...portuguesePage.home.search,
      label: 'Encontre seu hotel',
      tagline: 'Sua próxima viagem começa aqui.',
      mobileLink: 'Encontre sua próxima hospedagem',
    },
    hero: {
      ...portuguesePage.home.hero,
      label: 'Suas próximas férias',
      title: 'Seu próximo\nlugar feliz.',
      description:
        'Grandes aventuras. Pequenas escapadas.\nEncontre uma hospedagem que você vai amar.',
      action: 'Encontrar minha viagem',
      beachTitle: 'O sol\nestá chamando.',
      beachDescription: 'Responda com uma viagem à praia.',
    },
    inspiration: {
      ...portuguesePage.home.inspiration,
      title: 'Sejam como forem suas férias',
      aside: 'Temos inspiração para você.',
      beachImageAlt: 'Águas turquesa da costa mediterrânea turca',
      beachEyebrow: 'PENSANDO NO SOL?',
      beachAction: 'Explorar viagens à praia',
      cityImageAlt: 'A grandiosa arquitetura de Madri ao pôr do sol',
      cityAction: 'Encontre sua viagem urbana',
      farawayEyebrow: 'RESERVE TEMPO PARA VOCÊ',
      farawayAction: 'Descubra destinos distantes',
    },
    benefits: {
      ...portuguesePage.home.benefits,
      label: 'Por que escolher Best Holiday Packages',
      getawayTitle: 'Encontre sua viagem ideal',
      getawayDescription: 'De dias de praia a hospedagens na cidade',
      pricingDescription: 'Confira o preço antes de reservar',
      staysTitle: 'Todas as suas hospedagens juntas',
      staysDescription: 'Suas viagens em um só lugar',
    },
    destinations: {
      ...portuguesePage.home.destinations,
      eyebrow: 'SEU PRÓXIMO CARTÃO-POSTAL',
      description: 'Alguns lugares têm aquele clima de férias. Encontre o seu.',
      savedLink: 'Ideias salvas',
      savedLinkCount: 'Ideias salvas ({count})',
      save: 'Salvar {name}',
      unsave: 'Deixar de salvar {name}',
      note: 'Ideias para sua próxima viagem. Busque suas datas para ver hotéis disponíveis.',
    },
    categories: {
      ...portuguesePage.home.categories,
      beach: 'Viagens à praia',
      city: 'Viagens urbanas',
      faraway: 'Favoritos distantes',
    },
    saved: {
      title: 'Seus sonhos de férias',
      count: '{count} salvos',
      remove: 'Remover {name} das ideias salvas',
      empty:
        'Encontrou um lugar que ama? Toque no coração para reunir suas ideias durante esta visita.',
      announcement: 'Destinos salvos para esta visita: {count}.',
    },
    escape: {
      ...portuguesePage.home.escape,
      eyebrow: 'FORA DO ESCRITÓRIO. NO SEU ELEMENTO.',
      title: 'As coisas boas começam com uma viagem.',
      action: 'Vamos encontrar sua hospedagem',
    },
    help: {
      ...portuguesePage.home.help,
      title: 'Tudo pronto para sua próxima hospedagem?',
      description: 'Respostas a algumas das suas dúvidas.',
      searchAnswer:
        'Digite um código de destino, as datas de entrada e saída e os hóspedes. Defina a nacionalidade do hóspede principal no painel de hóspedes, escolha a moeda no cabeçalho e selecione Buscar.',
      priceAnswer:
        'O preço e a disponibilidade são verificados novamente antes de reservar. Você pode conferir o total atualizado e as condições de cancelamento antes de continuar.',
      roomsAnswer:
        'Você pode buscar até quatro quartos. Informe os adultos, as crianças e suas idades em cada quarto para incluir todos os viajantes.',
      bookingAnswer:
        'Entre na sua conta e abra as reservas para ver a hospedagem e o status atual. O hotel só está confirmado quando o status da reserva indica confirmação.',
      myBookings: 'Minhas reservas',
    },
    dialog: { ...portuguesePage.home.dialog, action: 'Planeje sua próxima hospedagem' },
    places: {
      ...portuguesePage.home.places,
      greece: {
        ...portuguesePage.home.places.greece,
        description:
          'Vilarejos brancos, pequenas tavernas à beira-mar e novos tons de azul em cada esquina. Desacelere e encontre seu pedaço de vida nas ilhas.',
      },
      turkey: {
        ...portuguesePage.home.places.turkey,
        description:
          'Passe os dias entre baías cercadas de pinheiros e centros históricos cheios de personalidade. Reserve tempo para manhãs tranquilas na praia e um pouco de aventura.',
      },
      tropical: {
        ...portuguesePage.home.places.tropical,
        country: 'Em algum lugar distante',
        tag: 'Sua pausa do escritório',
        description:
          'Troque a rotina por águas quentes e dias sem pressa. Caminhe descalço, leia na praia e contemple o oceano. Do Caribe ao Índico, encontre seu lugar feliz.',
      },
      madrid: { ...portuguesePage.home.places.madrid, name: 'Madri', imageAlt: 'Vista de Madri' },
      dubai: {
        ...portuguesePage.home.places.dubai,
        description:
          'Combine a descoberta da cidade com tempo na praia. Explore calçadões à beira-mar, cafés de bairro e vistas espetaculares mesmo depois do pôr do sol.',
        imageAlt: 'Vista de Dubai',
      },
    },
  },
  booking: {
    ...portuguesePage.booking,
    statuses: {
      ...portuguesePage.booking.statuses,
      BOOKING_PENDING: 'Aguardando conclusão',
      BOOKING_PROCESSING: 'Confirmando com o hotel',
      BOOKING_FAILED: 'Falha na reserva',
      PAYMENT_FAILED: 'Falha no pagamento',
    },
    details: {
      ...portuguesePage.booking.details,
      reconciliation:
        'Sua reserva está em análise. Não faça outro pagamento enquanto a confirmação estiver pendente.',
      cancellationQuestion:
        'Solicitar o cancelamento desta reserva? A política do fornecedor e eventuais cobranças continuam se aplicando.',
      requesting: 'Solicitando…',
      requestCancellation: 'Solicitar cancelamento',
    },
    list: {
      ...portuguesePage.booking.list,
      emptyTitle: 'Sua próxima viagem começa aqui',
      emptyDescription: 'Suas reservas aparecerão aqui quando você iniciar uma.',
    },
    price: {
      ...portuguesePage.booking.price,
      totalDescription: 'Total da hospedagem, incluindo impostos e taxas aplicáveis',
    },
    checkout: {
      ...portuguesePage.booking.checkout,
      progressed:
        'Esta reserva já passou da etapa de dados dos hóspedes. Abra os detalhes para ver o status atual.',
      savedGuests:
        'Os dados dos hóspedes estão salvos. Retome aqui uma reserva em andamento se o pagamento tiver sido interrompido.',
      continueSaved: 'Continuar o pagamento com os dados salvos',
      status: 'Status do processo: {status}. A reserva só é confirmada quando o hotel a aceita.',
      statusUnavailable:
        'Consulte os detalhes da reserva para ver o status atualizado do pagamento',
      viewStatus: 'Ver status da reserva',
    },
    guests: {
      ...portuguesePage.booking.guests,
      contactEmail: 'E-mail de contato',
      contactPhone: 'Telefone de contato',
      firstName: 'Nome',
      lastName: 'Sobrenome',
      emailError: 'Digite um e-mail de contato válido.',
      phoneError: 'Digite um telefone entre 5 e 30 caracteres.',
      firstNameError: 'Digite um nome entre 1 e 100 caracteres.',
      lastNameError: 'Digite um sobrenome entre 1 e 100 caracteres.',
      detailsError: 'Confira os dados. Exatamente um adulto deve ser o hóspede principal.',
      preparing: 'Preparando a reserva…',
      continue: 'Salvar hóspedes e continuar para o pagamento',
    },
    rate: {
      ...portuguesePage.booking.rate,
      checking: 'Verificando disponibilidade…',
      creating: 'Criando reserva…',
    },
  },
  results: {
    ...portuguesePage.results,
    checkingAvailability: 'Verificando disponibilidade…',
    chooseSearch: 'Escolha destino, datas e hóspedes para ver hotéis disponíveis.',
    noHotels: 'Nenhum hotel corresponde à busca. Tente outras datas ou filtros.',
    fullStayFrom: 'Hospedagem completa a partir de',
    loadingHotel: 'Carregando detalhes do hotel…',
    hotelInformationFallback: 'As informações do hotel são fornecidas pelo fornecedor conectado.',
    roomsForStay: 'Quartos para sua hospedagem',
    searchAvailability: 'Buscar disponibilidade',
    loadingRooms: 'Verificando disponibilidade dos quartos…',
    stayTotal: 'Total da hospedagem · confirmado ao concluir',
    noRooms: 'Não há quartos disponíveis para estas datas. Tente outra busca.',
    firstName: 'Nome',
    lastName: 'Sobrenome',
    nameError: 'Digite um nome entre 1 e 100 caracteres.',
    phoneError: 'Digite um telefone entre 5 e 30 caracteres.',
    nationalityPlaceholder: 'ex.: PK',
    nationalityError: 'Digite um código de país de duas letras.',
    saving: 'Salvando…',
    saveProfile: 'Salvar perfil',
    profileSaved: 'Perfil salvo.',
    loadingAccount: 'Carregando conta…',
  },
  app: {
    ...portuguesePage.app,
    skipContent: 'Pular para o conteúdo',
    pageTitle: 'Best Holiday Packages · Encontre sua próxima hospedagem',
    pageDescription: 'Descubra seu próximo destino e encontre um hotel com Best Holiday Packages.',
    languageDescription: 'Escolha o idioma do site, incluindo as páginas de busca e reserva.',
    accountTitle: 'Minha conta',
    accountDescription: 'Tenha seus dados de contato prontos para a próxima hospedagem.',
    bookingsTitle: 'Minhas reservas',
    bookingsDescription: 'Confira próximas hospedagens e acompanhe as atualizações das reservas.',
    checkoutDescription:
      'Confira o preço atualizado, adicione hóspedes e continue para o pagamento.',
    hotelsDescription: 'Explore quartos para sua hospedagem.',
    signInUnavailable: 'O login ainda não está disponível',
    accountUnavailable:
      'Os serviços de conta e reserva estarão disponíveis quando a autenticação estiver configurada. Você ainda pode buscar hotéis.',
    backToSearch: 'Voltar à busca',
    errorTitle: 'Algo deu errado',
    loadingPage: 'Carregando página',
    loading: 'Carregando…',
    requestError:
      'Não foi possível concluir a solicitação. Se você estava reservando ou pagando, confira o status antes de tentar novamente.',
    sessionExpired: 'Entre na sua conta para continuar.',
    accessDenied: 'Você não tem acesso a esta página ou reserva.',
    hotelUnavailable: 'Este hotel ou quarto não está mais disponível. Busque novamente.',
    quoteUsed: 'Este orçamento já foi utilizado. Confira suas reservas antes de criar outra.',
    bookingChanged: 'Esta reserva mudou. Abra os detalhes para ver o status atual.',
    invalidStay: 'Escolha datas de entrada e saída válidas e busque novamente.',
    unsupportedCurrency:
      'Esta moeda não é aceita para a reserva. Escolha outra e busque novamente.',
    paymentReview:
      'O resultado do pagamento está sendo verificado. Não pague novamente. Consulte a reserva para atualizações.',
    cancellationUnavailable:
      'O cancelamento online está indisponível. Entre em contato com o suporte para obter ajuda.',
    paymentsUnavailable: 'Os pagamentos não estão configurados. Nenhuma cobrança foi feita.',
    inventoryUnavailable:
      'A disponibilidade de hotéis não pode ser consultada agora. Tente mais tarde.',
    validationError: 'Confira os dados informados e tente novamente.',
  },
};
