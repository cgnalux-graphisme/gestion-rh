import { Html, Head, Body, Container, Heading, Text, Button } from '@react-email/components'

interface Props {
  prenom: string
  appUrl: string
}

export default function WelcomeEmail({ prenom, appUrl }: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', background: '#f0f2f8' }}>
        <Container
          style={{
            maxWidth: 520,
            margin: '40px auto',
            background: '#fff',
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                display: 'inline-block',
                background: '#e53e3e',
                color: '#fff',
                fontWeight: 900,
                fontSize: 22,
                borderRadius: 8,
                padding: '6px 16px',
              }}
            >
              CG
            </div>
          </div>

          <Heading style={{ color: '#1a2332', fontSize: 20 }}>
            Compte activé, {prenom} ! 🎉
          </Heading>
          <Text style={{ color: '#374151', lineHeight: 1.6 }}>
            Votre compte sur le portail RH de la Centrale Générale FGTB Namur-Luxembourg
            est maintenant actif. Vous pouvez vous connecter à tout moment.
          </Text>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button
              href={appUrl}
              style={{
                background: '#e53e3e',
                color: '#fff',
                padding: '13px 28px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Accéder au portail RH
            </Button>
          </div>
        </Container>
      </Body>
    </Html>
  )
}
