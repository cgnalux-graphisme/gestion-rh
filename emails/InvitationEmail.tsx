import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Hr,
} from '@react-email/components'

interface Props {
  prenom: string
  otpCode: string
  activationUrl: string
}

export default function InvitationEmail({ prenom, otpCode, activationUrl }: Props) {
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
                letterSpacing: 1,
              }}
            >
              CG
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
              Centrale Générale FGTB Namur-Luxembourg
            </div>
          </div>

          <Heading style={{ color: '#1a2332', fontSize: 20, marginBottom: 8 }}>
            Bienvenue, {prenom} 👋
          </Heading>
          <Text style={{ color: '#374151', lineHeight: 1.6 }}>
            Votre compte a été créé sur le portail RH de la Centrale Générale FGTB
            Namur-Luxembourg.
          </Text>
          <Text style={{ color: '#374151', lineHeight: 1.6 }}>
            Pour activer votre compte, rendez-vous sur la page d'activation et saisissez
            le code suivant :
          </Text>

          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <div
              style={{
                fontSize: 40,
                fontWeight: 900,
                letterSpacing: 14,
                color: '#e53e3e',
                background: '#fef2f2',
                padding: '18px 32px',
                borderRadius: 10,
                display: 'inline-block',
                border: '2px dashed #fca5a5',
              }}
            >
              {otpCode}
            </div>
          </Section>

          <Text style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>
            Ce code est valable <strong>48 heures</strong>.
          </Text>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Button
              href={activationUrl}
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
              Activer mon compte
            </Button>
          </div>

          <Hr style={{ margin: '28px 0', borderColor: '#f3f4f6' }} />
          <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
            Si vous n'attendiez pas cet email, vous pouvez l'ignorer sans risque.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
