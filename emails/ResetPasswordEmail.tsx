import { Html, Head, Body, Container, Heading, Text, Section, Hr } from '@react-email/components'

interface Props {
  prenom: string
  otpCode: string
}

export default function ResetPasswordEmail({ prenom, otpCode }: Props) {
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
            Réinitialisation de mot de passe
          </Heading>
          <Text style={{ color: '#374151', lineHeight: 1.6 }}>
            Bonjour {prenom}, voici votre code de réinitialisation :
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
            Ce code expire dans <strong>10 minutes</strong>.
          </Text>

          <Hr style={{ margin: '28px 0', borderColor: '#f3f4f6' }} />
          <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
