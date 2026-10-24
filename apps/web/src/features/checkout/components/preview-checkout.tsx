'use client';

import { ArrowLeft, ArrowRight, Check, CreditCard, LockKeyhole } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';

import {
  type PreviewHotel,
  previewMoney,
  type PreviewRoom,
  readPreviewStay,
} from '@/features/hotel-search/data/preview-hotels';

import styles from './preview-checkout.module.css';
import { PreviewCheckoutSummary } from './preview-checkout-summary';
import {
  type PreviewTransferId,
  PreviewTransferOptions,
  previewTransfers,
} from './preview-transfer-options';

type CheckoutStep = 0 | 1 | 2;
type Passenger = { firstName: string; lastName: string; email: string; phone: string };
const steps = ['Extras', 'Passengers', 'Payment'] as const;

export function PreviewCheckout({ hotel, room }: { hotel: PreviewHotel; room: PreviewRoom }) {
  const params = useSearchParams();
  const stay = readPreviewStay(params);
  const [step, setStep] = useState<CheckoutStep>(0);
  const [furthestStep, setFurthestStep] = useState<CheckoutStep>(0);
  const [transferId, setTransferId] = useState<PreviewTransferId | null>(null);
  const [pickup, setPickup] = useState('airport');
  const [passenger, setPassenger] = useState<Passenger>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const panelRef = useRef<HTMLDivElement>(null);
  const transfer = previewTransfers.find((item) => item.id === transferId);
  const sampleTotal = room.totalMinor + (transfer?.priceMinor ?? 0);

  function goToStep(next: CheckoutStep) {
    setStep(next);
    setFurthestStep((current) => Math.max(current, next) as CheckoutStep);
    requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
      panelRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }

  function changePassenger(field: keyof Passenger, value: string) {
    setPassenger((current) => ({ ...current, [field]: value }));
    setFurthestStep(1);
  }

  return (
    <div className={styles.page} lang="en" dir="ltr">
      <div className={styles.layout}>
        <div className={styles.main}>
          <nav aria-label="Checkout progress" className={styles.progress}>
            <ol>
              {steps.map((label, index) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => goToStep(index as CheckoutStep)}
                    disabled={index > furthestStep}
                    aria-current={index === step ? 'step' : undefined}
                    className={
                      index === step
                        ? styles.activeStep
                        : index < step
                          ? styles.completedStep
                          : undefined
                    }
                  >
                    <span>{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
                    {label}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div ref={panelRef} tabIndex={-1} className={styles.stepPanel}>
            {step === 0 ? (
              <>
                <PreviewTransferOptions
                  selected={transferId}
                  pickup={pickup}
                  onSelect={setTransferId}
                  onPickupChange={setPickup}
                />
                <div className={styles.actions}>
                  <button
                    className={styles.continueButton}
                    type="button"
                    onClick={() => goToStep(1)}
                  >
                    Continue to passengers <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : null}
            {step === 1 ? (
              <section aria-labelledby="passengers-heading">
                <h1 id="passengers-heading" className={styles.heading}>
                  Passenger details
                </h1>
                <p className={styles.introduction}>Who is the lead guest for your stay?</p>
                <p className={styles.demoNote}>
                  Use placeholder details to explore this preview. Nothing is submitted or saved.
                </p>
                <form
                  className={styles.passengerForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    goToStep(2);
                  }}
                >
                  <div className={styles.formRow}>
                    <label>
                      First name
                      <input
                        type="text"
                        name="preview-first-name"
                        autoComplete="off"
                        value={passenger.firstName}
                        onChange={(event) => changePassenger('firstName', event.target.value)}
                        required
                        maxLength={80}
                        pattern=".*\S.*"
                        placeholder="e.g. Alex"
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        type="text"
                        name="preview-last-name"
                        autoComplete="off"
                        value={passenger.lastName}
                        onChange={(event) => changePassenger('lastName', event.target.value)}
                        required
                        maxLength={80}
                        pattern=".*\S.*"
                        placeholder="e.g. Taylor"
                      />
                    </label>
                  </div>
                  <label>
                    Email address
                    <input
                      type="email"
                      name="preview-email"
                      autoComplete="off"
                      value={passenger.email}
                      onChange={(event) => changePassenger('email', event.target.value)}
                      required
                      maxLength={254}
                      placeholder="alex@example.com"
                    />
                  </label>
                  <label>
                    Phone number <span className={styles.optional}>(optional)</span>
                    <input
                      type="tel"
                      name="preview-phone"
                      autoComplete="off"
                      value={passenger.phone}
                      onChange={(event) => changePassenger('phone', event.target.value)}
                      maxLength={30}
                      placeholder="Include country code"
                    />
                  </label>
                  <div className={styles.actions}>
                    <button type="button" className={styles.backButton} onClick={() => goToStep(0)}>
                      <ArrowLeft size={16} aria-hidden="true" />
                      Back
                    </button>
                    <button className={styles.continueButton} type="submit">
                      Continue to payment <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </form>
              </section>
            ) : null}
            {step === 2 ? (
              <section aria-labelledby="payment-heading">
                <h1 id="payment-heading" className={styles.heading}>
                  Payment
                </h1>
                <p className={styles.introduction}>Review your holiday and choose how to pay.</p>
                <fieldset className={styles.paymentOptions}>
                  <legend>Payment method</legend>
                  <label className={styles.paymentOption}>
                    <CreditCard size={22} aria-hidden="true" />
                    <span>
                      Debit or credit card<small>Visa · Mastercard · American Express</small>
                    </span>
                    <input
                      type="radio"
                      name="preview-payment"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                    />
                  </label>
                  <label className={styles.paymentOption}>
                    <span className={styles.walletIcon}>P</span>
                    <span>
                      PayPal<small>Pay with your PayPal account</small>
                    </span>
                    <input
                      type="radio"
                      name="preview-payment"
                      checked={paymentMethod === 'paypal'}
                      onChange={() => setPaymentMethod('paypal')}
                    />
                  </label>
                </fieldset>
                {paymentMethod === 'card' ? (
                  <div className={styles.cardPreview}>
                    <p>
                      <CreditCard size={18} aria-hidden="true" />
                      Example card
                    </p>
                    <label>
                      Card number
                      <input
                        aria-label="Example card number"
                        readOnly
                        value="••••  ••••  ••••  4242"
                        tabIndex={-1}
                      />
                    </label>
                    <div className={styles.formRow}>
                      <label>
                        Expiry date
                        <input readOnly value="12 / 30" tabIndex={-1} />
                      </label>
                      <label>
                        Security code
                        <input readOnly value="•••" tabIndex={-1} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className={styles.demoNote}>
                    PayPal checkout will appear here when payments are connected.
                  </p>
                )}
                <div className={styles.paymentTotal}>
                  <span>Sample total</span>
                  <strong>{previewMoney(sampleTotal)}</strong>
                </div>
                <p className={styles.demoNote} id="preview-payment-notice">
                  <LockKeyhole size={17} aria-hidden="true" />
                  UI preview — no payment is taken. Card entry and payment processing are
                  unavailable.
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.backButton} onClick={() => goToStep(1)}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back
                  </button>
                  <button
                    className={styles.continueButton}
                    type="button"
                    disabled
                    aria-describedby="preview-payment-notice"
                  >
                    <LockKeyhole size={16} aria-hidden="true" />
                    Pay {previewMoney(sampleTotal)}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
        <PreviewCheckoutSummary hotel={hotel} room={room} stay={stay} transferId={transferId} />
      </div>
    </div>
  );
}
